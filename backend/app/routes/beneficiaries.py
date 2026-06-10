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
from app.services.excel import build_beneficiary_export
from app.dependencies import require_permission

router = APIRouter(prefix="/beneficiaries", tags=["beneficiaries"])


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
    files_processed = files_skipped = total_created = total_updated = total_skipped = 0
    errors: list[str] = []
    unknown_isins: list[str] = []

    try:
        zf = zipfile.ZipFile(io.BytesIO(contents))
    except zipfile.BadZipFile:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid ZIP file")

    txt_files = [n for n in zf.namelist() if n.lower().endswith(".txt") and not n.startswith("__")]

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
            file_record_date = header["record_date"]

            # Reject files whose ISIN has no matching company
            company_check = await db.execute(
                select(Company.isin_code).where(Company.isin_code == isin)
            )
            if not company_check.scalar_one_or_none():
                errors.append(f"{fname}: ISIN {isin} not found in Companies — add the company first")
                if isin not in unknown_isins:
                    unknown_isins.append(isin)
                files_skipped += 1
                continue

            # Process detail (02) records
            for rec in details:
                dp_id = rec["dp_id"]
                client_id = rec["client_id"]

                existing_result = await db.execute(
                    select(Beneficiary).where(
                        Beneficiary.isin_code == isin,
                        Beneficiary.dp_id == dp_id,
                        Beneficiary.client_id == client_id,
                    )
                )
                existing = existing_result.scalar_one_or_none()

                if existing:
                    # Only update if new file's record_date is newer
                    if file_record_date and existing.record_date and file_record_date <= existing.record_date:
                        total_skipped += 1
                        continue
                    for field, value in rec.items():
                        if value is not None:
                            setattr(existing, field, value)
                    existing.updated_at = datetime.now(timezone.utc)
                    total_updated += 1

                    # Refresh lock-in records for this beneficiary if date is newer
                    await db.execute(
                        delete(BenposLockin).where(
                            BenposLockin.isin_code == isin,
                            BenposLockin.dp_id == dp_id,
                            BenposLockin.client_id == client_id,
                        )
                    )
                else:
                    benef = Beneficiary(**rec)
                    db.add(benef)
                    total_created += 1

            # Process lock-in (03) records
            for rec in lockins:
                li = BenposLockin(**rec)
                db.add(li)

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
