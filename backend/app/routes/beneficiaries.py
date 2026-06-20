import io
import uuid
import zipfile
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func, delete

from app.database import get_db
from app.models.beneficiary import Beneficiary, BenposLockin
from app.models.company import Company
from app.models.user import User
from app.schemas.beneficiary import BeneficiaryListOut, BeneficiaryOut, ZipIngestResult
from app.services.benpos_parser import parse_benpos_file
from app.services.cdsl_parser import is_rt02, parse_rt95, parse_rt02
from app.services.excel import build_beneficiary_export
from app.dependencies import require_permission

router = APIRouter(prefix="/beneficiaries", tags=["beneficiaries"])

NSDL = "NSDL"
CDSL = "CDSL"


async def _wipe_depository(db: AsyncSession, depository: str) -> None:
    """Delete ALL beneficiaries of a depository (a fresh upload fully replaces it).
    NSDL also clears all benpos lock-ins, which are sourced from NSDL files only."""
    await db.execute(delete(Beneficiary).where(Beneficiary.depository == depository))
    if depository == NSDL:
        await db.execute(delete(BenposLockin))


async def _company_id_map(db: AsyncSession, isins: set[str]) -> dict[str, "uuid.UUID"]:
    """Map ISIN → company id for the given ISINs (only those with a company)."""
    if not isins:
        return {}
    rows = (await db.execute(
        select(Company.isin_code, Company.id).where(Company.isin_code.in_(isins))
    )).all()
    return {isin: cid for isin, cid in rows}


def _search_filter(query, search: str | None):
    if not search:
        return query
    term = f"%{search}%"
    return query.where(
        or_(
            Beneficiary.first_holder_name.ilike(term),
            Beneficiary.first_holder_pan.ilike(term),
            Beneficiary.dp_id.ilike(term),
            Beneficiary.client_id.ilike(term),
            Beneficiary.ifsc.ilike(term),
        )
    )


@router.get("/", response_model=list[BeneficiaryListOut])
async def list_beneficiaries(
    isin_code: str | None = Query(None),
    search: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    current_user: User = Depends(require_permission("viewer")),
    db: AsyncSession = Depends(get_db),
):
    query = select(Beneficiary).order_by(Beneficiary.first_holder_name)
    if isin_code:
        query = query.where(Beneficiary.isin_code == isin_code)
    query = _search_filter(query, search)
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/count")
async def count_beneficiaries(
    isin_code: str | None = Query(None),
    search: str | None = Query(None),
    current_user: User = Depends(require_permission("viewer")),
    db: AsyncSession = Depends(get_db),
):
    query = select(func.count()).select_from(Beneficiary)
    if isin_code:
        query = query.where(Beneficiary.isin_code == isin_code)
    query = _search_filter(query, search)
    result = await db.execute(query)
    return {"count": result.scalar()}


@router.get("/export")
async def export_beneficiaries(
    isin_code: str | None = Query(None),
    search: str | None = Query(None),
    current_user: User = Depends(require_permission("can_download")),
    db: AsyncSession = Depends(get_db),
):
    query = select(Beneficiary).order_by(Beneficiary.isin_code, Beneficiary.first_holder_name)
    if isin_code:
        query = query.where(Beneficiary.isin_code == isin_code)
    query = _search_filter(query, search)
    result = await db.execute(query)
    beneficiaries = result.scalars().all()

    rows = [
        {col: getattr(b, col) for col in [
            "isin_code", "dp_id", "client_id", "record_date",
            "first_holder_name", "first_holder_pan", "first_holder_email",
            "second_holder_name", "second_holder_pan",
            "third_holder_name", "third_holder_pan",
            "beneficiary_type", "account_category", "beneficiary_status",
            "address_line1", "address_line2", "address_line3", "address_line4", "pin_code",
            "bank_account_number", "bank_name_branch", "ifsc", "micr_code", "bank_account_type",
            "free_positions", "lockin_positions", "block_positions", "pledged_positions",
            "remat_positions", "idd_positions", "cm_pool_positions", "cc_settlement_positions",
            "minor_indicator", "rgess_flag",
        ]}
        for b in beneficiaries
    ]
    excel_bytes = build_beneficiary_export(rows)
    filename = f"beneficiaries{'_' + isin_code if isin_code else ''}.xlsx"
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.post("/ingest-zip", response_model=ZipIngestResult)
async def ingest_zip(
    file: Annotated[UploadFile, File()],
    current_user: User = Depends(require_permission("can_ingest")),
    db: AsyncSession = Depends(get_db),
):
    if not file.filename or not file.filename.lower().endswith(".zip"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only .zip files accepted")

    contents = await file.read()
    files_processed = files_skipped = total_created = total_updated = total_skipped = nsdl_updated = 0
    errors: list[str] = []
    unknown_isins: list[str] = []

    try:
        zf = zipfile.ZipFile(io.BytesIO(contents))
    except zipfile.BadZipFile:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid ZIP file")

    txt_files = [n for n in zf.namelist() if n.lower().endswith(".txt") and not n.startswith("__")]
    if not txt_files:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="ZIP contains no .txt NSDL files")

    # Full replace: wipe ALL NSDL beneficiaries (and lock-ins) before loading the new set
    await _wipe_depository(db, NSDL)

    for fname in txt_files:
        try:
            raw = zf.read(fname)
            # Try common encodings
            for enc in ("utf-8", "latin-1", "cp1252"):
                try:
                    text = raw.decode(enc)
                    break
                except UnicodeDecodeError:
                    continue
            else:
                errors.append(f"{fname}: could not decode file")
                files_skipped += 1
                continue

            header, details, lockins, parse_errors = parse_benpos_file(text)
            errors.extend([f"{fname}: {e}" for e in parse_errors])

            if not header or not header.get("isin_code"):
                errors.append(f"{fname}: no valid header, skipping file")
                files_skipped += 1
                continue

            isin = header["isin_code"]

            # Reject files whose ISIN has no matching company; fetch Company for later update
            company_result = await db.execute(
                select(Company).where(Company.isin_code == isin)
            )
            company_obj = company_result.scalar_one_or_none()
            if not company_obj:
                errors.append(f"{fname}: ISIN {isin} not found in Companies — add the company first")
                if isin not in unknown_isins:
                    unknown_isins.append(isin)
                files_skipped += 1
                continue

            # NSDL data was already wiped globally above; just load this ISIN's rows
            for rec in details:
                dp_id = rec["dp_id"]
                client_id = rec["client_id"]
                if not dp_id or not client_id:
                    continue
                rec["depository"] = NSDL
                rec["company_id"] = company_obj.id
                db.add(Beneficiary(**rec))
                total_created += 1

            for rec in lockins:
                rec["company_id"] = company_obj.id
                db.add(BenposLockin(**rec))

            # Sync NSDL share total from file header into company record
            total_nsdl = header.get("total_nsdl_positions")
            if total_nsdl is not None:
                company_obj.nsdl_shares = int(total_nsdl)
                if total_nsdl > 0:
                    company_obj.has_nsdl_shares = True
                company_obj.updated_at = datetime.now(timezone.utc)
                nsdl_updated += 1

            files_processed += 1

        except Exception as e:
            errors.append(f"{fname}: unexpected error — {e}")
            files_skipped += 1

    await db.commit()

    return ZipIngestResult(
        files_processed=files_processed,
        files_skipped=files_skipped,
        total_created=total_created,
        total_updated=total_updated,
        total_skipped=total_skipped,
        errors=errors[:50],
        unknown_isins=unknown_isins,
        nsdl_updated=nsdl_updated,
    )


@router.post("/ingest-cdsl-zip", response_model=ZipIngestResult)
async def ingest_cdsl_zip(
    file: Annotated[UploadFile, File()],
    current_user: User = Depends(require_permission("can_ingest")),
    db: AsyncSession = Depends(get_db),
):
    if not file.filename or not file.filename.lower().endswith(".zip"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only .zip files accepted")

    contents = await file.read()
    total_created = total_updated = total_skipped = cdsl_updated = 0
    errors: list[str] = []
    unknown_isins: list[str] = []

    try:
        zf = zipfile.ZipFile(io.BytesIO(contents))
    except zipfile.BadZipFile:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid ZIP file")

    members = [n for n in zf.namelist() if not n.startswith("__") and not n.endswith("/")]
    if len(members) < 2:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="ZIP must contain exactly 2 CDSL files (RT95 + RT02)")

    rt95_content: str | None = None
    rt02_content: str | None = None

    for fname in members:
        raw = zf.read(fname)
        for enc in ("utf-8", "latin-1", "cp1252"):
            try:
                text = raw.decode(enc)
                break
            except UnicodeDecodeError:
                continue
        else:
            errors.append(f"{fname}: could not decode")
            continue
        if is_rt02(text):
            rt02_content = text
        else:
            rt95_content = text

    if not rt95_content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Could not identify RT95 (total shares) file in ZIP")
    if not rt02_content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Could not identify RT02 (beneficiary detail) file in ZIP")

    # --- RT95: update cdsl_shares on companies ---
    rt95_rows = parse_rt95(rt95_content)
    isins_in_rt95: set[str] = set()
    for row in rt95_rows:
        isin = row["isin"]
        isins_in_rt95.add(isin)
        company_result = await db.execute(select(Company).where(Company.isin_code == isin))
        company_obj = company_result.scalar_one_or_none()
        if not company_obj:
            if isin not in unknown_isins:
                unknown_isins.append(isin)
            continue
        company_obj.cdsl_shares = row["cdsl_shares"]
        company_obj.has_cdsl_shares = row["cdsl_shares"] > 0
        company_obj.updated_at = datetime.now(timezone.utc)
        cdsl_updated += 1

    # --- RT02: full replace — wipe ALL CDSL beneficiaries, then load the new set ---
    records, parse_errors = parse_rt02(rt02_content)
    errors.extend(parse_errors[:20])

    await _wipe_depository(db, CDSL)

    cid_map = await _company_id_map(db, {rec["isin_code"] for rec in records})
    for rec in records:
        isin = rec["isin_code"]
        company_id = cid_map.get(isin)
        if company_id is None:
            if isin not in unknown_isins:
                unknown_isins.append(isin)
            total_skipped += 1
            continue
        rec["depository"] = CDSL
        rec["company_id"] = company_id
        db.add(Beneficiary(**rec))
        total_created += 1

    await db.commit()

    return ZipIngestResult(
        files_processed=2,
        files_skipped=0,
        total_created=total_created,
        total_updated=total_updated,
        total_skipped=total_skipped,
        errors=errors[:50],
        unknown_isins=unknown_isins,
        cdsl_updated=cdsl_updated,
    )


@router.get("/{beneficiary_id}", response_model=BeneficiaryOut)
async def get_beneficiary(
    beneficiary_id: uuid.UUID,
    current_user: User = Depends(require_permission("viewer")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Beneficiary).where(Beneficiary.id == beneficiary_id))
    b = result.scalar_one_or_none()
    if not b:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Beneficiary not found")
    return b
