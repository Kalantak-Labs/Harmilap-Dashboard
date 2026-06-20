import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import Response
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func, delete

from app.database import get_db
from app.models.company import Company
from app.models.beneficiary import Beneficiary, BenposLockin
from app.models.generated_invoice import GeneratedInvoice
from app.models.invoice import Invoice
from app.models.user import User
from app.schemas.company import (
    CompanyCreate, CompanyUpdate, CompanyOut, CompanyListOut, IngestResult, CompanyStats,
    _validate_isin,
)
from app.reference_data import GST_STATE_CODES, PAN_HOLDER_TYPES
from app.services.excel import parse_excel, build_export_excel
from app.dependencies import get_current_user, require_permission

router = APIRouter(prefix="/companies", tags=["companies"])


def _recalc_physical(company: Company) -> None:
    """Physical shares are derived: total − NSDL − CDSL. None when total is unset."""
    if company.total_shares is None:
        company.physical_shares = None
    else:
        company.physical_shares = (
            company.total_shares - (company.nsdl_shares or 0) - (company.cdsl_shares or 0)
        )


def _sync_depository_flags(company: Company) -> None:
    """A filled NSDL/CDSL RTA code marks the company as present in that depository."""
    if (company.nsdl_rta_code or "").strip():
        company.has_nsdl_shares = True
    if (company.cdsl_rta_code or "").strip():
        company.has_cdsl_shares = True


def _derive_company_info(company: Company) -> None:
    """Fill PAN from GST when missing, derive PAN holder type and the GST state."""
    gst = (company.gst_number or "").strip().upper()
    # GST chars 3–12 are the PAN — use it when PAN is not provided.
    if not (company.pan_number or "").strip() and len(gst) == 15:
        company.pan_number = gst[2:12]
    pan = (company.pan_number or "").strip().upper()
    company.pan_holder_type = PAN_HOLDER_TYPES.get(pan[3]) if len(pan) == 10 else None
    # GST state code (first 2 digits) → state, only when state is not set manually.
    if not (company.state or "").strip() and len(gst) >= 2:
        company.state = GST_STATE_CODES.get(gst[:2])


def _apply_search(query, search: str | None):
    if not search:
        return query
    term = f"%{search}%"
    return query.where(
        or_(
            Company.company_name.ilike(term),
            Company.isin_code.ilike(term),
            Company.arn_number.ilike(term),
            Company.nsdl_rta_code.ilike(term),
            Company.cdsl_rta_code.ilike(term),
            Company.pan_number.ilike(term),
        )
    )


@router.get("/", response_model=list[CompanyListOut])
async def list_companies(
    search: str | None = Query(None),
    security_type: str | None = Query(None),
    has_nsdl: bool | None = Query(None),
    has_cdsl: bool | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    current_user: User = Depends(require_permission("viewer")),
    db: AsyncSession = Depends(get_db),
):
    query = select(Company).order_by(Company.company_name)
    query = _apply_search(query, search)
    if security_type:
        query = query.where(Company.security_type == security_type)
    if has_nsdl is not None:
        query = query.where(Company.has_nsdl_shares == has_nsdl)
    if has_cdsl is not None:
        query = query.where(Company.has_cdsl_shares == has_cdsl)
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/count")
async def count_companies(
    search: str | None = Query(None),
    security_type: str | None = Query(None),
    has_nsdl: bool | None = Query(None),
    has_cdsl: bool | None = Query(None),
    current_user: User = Depends(require_permission("viewer")),
    db: AsyncSession = Depends(get_db),
):
    query = select(func.count()).select_from(Company)
    if search:
        term = f"%{search}%"
        query = query.where(
            or_(
                Company.company_name.ilike(term),
                Company.isin_code.ilike(term),
                Company.arn_number.ilike(term),
                Company.nsdl_rta_code.ilike(term),
                Company.cdsl_rta_code.ilike(term),
                Company.pan_number.ilike(term),
            )
        )
    if security_type:
        query = query.where(Company.security_type == security_type)
    if has_nsdl is not None:
        query = query.where(Company.has_nsdl_shares == has_nsdl)
    if has_cdsl is not None:
        query = query.where(Company.has_cdsl_shares == has_cdsl)
    result = await db.execute(query)
    return {"count": result.scalar()}


@router.get("/export")
async def export_companies(
    search: str | None = Query(None),
    security_type: str | None = Query(None),
    has_nsdl: bool | None = Query(None),
    has_cdsl: bool | None = Query(None),
    current_user: User = Depends(require_permission("can_download")),
    db: AsyncSession = Depends(get_db),
):
    query = select(Company).order_by(Company.company_name)
    query = _apply_search(query, search)
    if security_type:
        query = query.where(Company.security_type == security_type)
    if has_nsdl is not None:
        query = query.where(Company.has_nsdl_shares == has_nsdl)
    if has_cdsl is not None:
        query = query.where(Company.has_cdsl_shares == has_cdsl)

    result = await db.execute(query)
    companies = result.scalars().all()

    rows = []
    for c in companies:
        rows.append({
            col: getattr(c, col)
            for col in [
                "company_name", "isin_code", "arn_number", "nsdl_rta_code", "cdsl_rta_code", "email_ids", "contact_numbers",
                "authorized_person_name", "authorized_person_designation",
                "gst_number", "tan_number", "pan_number",
                "reg_address_line1", "reg_address_line2", "reg_address_line3", "reg_address_line4",
                "reg_city", "reg_pin_code", "billing_address", "security_type",
                "total_shares", "has_nsdl_shares", "nsdl_shares",
                "has_cdsl_shares", "cdsl_shares", "physical_shares",
            ]
        })

    excel_bytes = build_export_excel(rows)
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=companies.xlsx"},
    )


@router.post("/ingest", response_model=IngestResult)
async def ingest_excel(
    file: Annotated[UploadFile, File()],
    current_user: User = Depends(require_permission("can_ingest")),
    db: AsyncSession = Depends(get_db),
):
    if not file.filename or not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only .xlsx or .xls files accepted")

    contents = await file.read()
    rows, parse_errors = parse_excel(contents)

    created = updated = skipped = 0
    errors = list(parse_errors)

    for row in rows:
        isin = row.get("isin_code")
        arn = row.get("arn_number")

        # Normalise ISIN — validate full format (structure + Luhn) when present
        if isin:
            isin = str(isin).strip().upper()
            try:
                isin = _validate_isin(isin)
            except ValueError as e:
                errors.append(f"ISIN '{isin}': {e} — skipped")
                skipped += 1
                continue
            row["isin_code"] = isin
        else:
            isin = None
            row.pop("isin_code", None)

        # Normalise ARN — free-form identifier
        if arn:
            arn = str(arn).strip().upper()
            row["arn_number"] = arn
        else:
            arn = None
            row.pop("arn_number", None)

        # A row must carry at least one key (ISIN preferred, otherwise ARN)
        if not isin and not arn:
            skipped += 1
            continue

        key_label = f"ISIN {isin}" if isin else f"ARN {arn}"

        try:
            # Match an existing company by ISIN when present, otherwise by ARN
            if isin:
                result = await db.execute(select(Company).where(Company.isin_code == isin))
            else:
                result = await db.execute(select(Company).where(Company.arn_number == arn))
            existing = result.scalar_one_or_none()

            if existing:
                for field, value in row.items():
                    if field not in ("isin_code", "arn_number") and value is not None:
                        setattr(existing, field, value)
                _recalc_physical(existing)
                _sync_depository_flags(existing)
                _derive_company_info(existing)
                existing.updated_at = datetime.now(timezone.utc)
                existing.updated_by = current_user.id
                updated += 1
            else:
                company = Company(
                    **{k: v for k, v in row.items()},
                    created_by=current_user.id,
                    updated_by=current_user.id,
                )
                _recalc_physical(company)
                _sync_depository_flags(company)
                _derive_company_info(company)
                db.add(company)
                created += 1

        except Exception as e:
            errors.append(f"{key_label}: {e}")
            skipped += 1

    await db.commit()
    return IngestResult(created=created, updated=updated, skipped=skipped, errors=errors)


@router.post("/", response_model=CompanyOut, status_code=status.HTTP_201_CREATED)
async def create_company(
    body: CompanyCreate,
    current_user: User = Depends(require_permission("editor")),
    db: AsyncSession = Depends(get_db),
):
    if body.isin_code:
        existing = await db.execute(select(Company).where(Company.isin_code == body.isin_code))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"ISIN {body.isin_code} already exists")
    if body.arn_number:
        existing = await db.execute(select(Company).where(Company.arn_number == body.arn_number))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"ARN {body.arn_number} already exists")

    company = Company(**body.model_dump(), created_by=current_user.id, updated_by=current_user.id)
    _recalc_physical(company)
    _sync_depository_flags(company)
    _derive_company_info(company)
    db.add(company)
    await db.commit()
    await db.refresh(company)
    return company


@router.get("/{company_id}/stats", response_model=CompanyStats)
async def company_stats(
    company_id: uuid.UUID,
    current_user: User = Depends(require_permission("viewer")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Company).where(Company.id == company_id))
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")

    beneficiary_count = 0
    if company.isin_code:
        bc = await db.execute(
            select(func.count(Beneficiary.id)).where(Beneficiary.isin_code == company.isin_code)
        )
        beneficiary_count = bc.scalar() or 0
    ic = await db.execute(
        select(func.count(GeneratedInvoice.id)).where(GeneratedInvoice.company_id == company.id)
    )
    return CompanyStats(
        beneficiary_count=beneficiary_count,
        invoice_count=ic.scalar() or 0,
    )


@router.get("/{company_id}", response_model=CompanyOut)
async def get_company(
    company_id: uuid.UUID,
    current_user: User = Depends(require_permission("viewer")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Company).where(Company.id == company_id))
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")
    return company


@router.patch("/{company_id}", response_model=CompanyOut)
async def update_company(
    company_id: uuid.UUID,
    body: CompanyUpdate,
    current_user: User = Depends(require_permission("editor")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Company).where(Company.id == company_id))
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")

    updates = body.model_dump(exclude_none=True)

    # Guard uniqueness when ISIN/ARN are being changed
    new_isin = updates.get("isin_code")
    if new_isin and new_isin != company.isin_code:
        dup = await db.execute(
            select(Company).where(Company.isin_code == new_isin, Company.id != company_id)
        )
        if dup.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"ISIN {new_isin} already exists")
    new_arn = updates.get("arn_number")
    if new_arn and new_arn != company.arn_number:
        dup = await db.execute(
            select(Company).where(Company.arn_number == new_arn, Company.id != company_id)
        )
        if dup.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"ARN {new_arn} already exists")

    for field, value in updates.items():
        setattr(company, field, value)
    _recalc_physical(company)
    _sync_depository_flags(company)
    _derive_company_info(company)

    if not company.isin_code and not company.arn_number:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A company must have either an ISIN code or an ARN number",
        )

    company.updated_at = datetime.now(timezone.utc)
    company.updated_by = current_user.id
    await db.commit()
    await db.refresh(company)
    return company


@router.delete("/{company_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_company(
    company_id: uuid.UUID,
    current_user: User = Depends(require_permission("editor")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Company).where(Company.id == company_id))
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")

    isin = company.isin_code
    nsdl_rta = company.nsdl_rta_code
    cdsl_rta = company.cdsl_rta_code

    # Beneficiaries / lock-ins cascade via the company_id FK; the explicit deletes
    # are a safeguard for any rows keyed only by ISIN.
    if isin:
        await db.execute(delete(BenposLockin).where(BenposLockin.isin_code == isin))
        await db.execute(delete(Beneficiary).where(Beneficiary.isin_code == isin))
    await db.execute(delete(GeneratedInvoice).where(GeneratedInvoice.company_id == company.id))

    await db.delete(company)
    await db.flush()

    # Remove invoices orphaned by this delete: an invoice is orphaned only when
    # neither of its RTA codes maps to any remaining company.
    codes = [c for c in (nsdl_rta, cdsl_rta) if c]
    if codes:
        candidates = (await db.execute(
            select(Invoice).where(or_(Invoice.nsdl_rta_code.in_(codes), Invoice.cdsl_rta_code.in_(codes)))
        )).scalars().all()
        for inv in candidates:
            mapped = False
            if inv.nsdl_rta_code:
                mapped = (await db.execute(
                    select(Company.id).where(Company.nsdl_rta_code == inv.nsdl_rta_code).limit(1)
                )).scalar_one_or_none() is not None
            if not mapped and inv.cdsl_rta_code:
                mapped = (await db.execute(
                    select(Company.id).where(Company.cdsl_rta_code == inv.cdsl_rta_code).limit(1)
                )).scalar_one_or_none() is not None
            if not mapped:
                await db.delete(inv)

    await db.commit()
