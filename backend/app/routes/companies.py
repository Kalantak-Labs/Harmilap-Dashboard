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
from app.models.user import User
from app.schemas.company import CompanyCreate, CompanyUpdate, CompanyOut, CompanyListOut, IngestResult, CompanyStats
from app.services.excel import parse_excel, build_export_excel
from app.dependencies import get_current_user, require_permission

router = APIRouter(prefix="/companies", tags=["companies"])


def _apply_search(query, search: str | None):
    if not search:
        return query
    term = f"%{search}%"
    return query.where(
        or_(
            Company.company_name.ilike(term),
            Company.isin_code.ilike(term),
            Company.rta_code.ilike(term),
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
                Company.rta_code.ilike(term),
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
                "company_name", "isin_code", "rta_code", "email_ids", "contact_numbers",
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
        if not isin:
            skipped += 1
            continue

        # Normalise and validate ISIN format
        isin = str(isin).strip().upper()
        if len(isin) != 12 or not isin.isalnum():
            errors.append(f"ISIN '{isin}': invalid format (must be 12 alphanumeric characters) — skipped")
            skipped += 1
            continue

        row["isin_code"] = isin

        try:
            result = await db.execute(select(Company).where(Company.isin_code == isin))
            existing = result.scalar_one_or_none()

            if existing:
                for field, value in row.items():
                    if field != "isin_code" and value is not None:
                        setattr(existing, field, value)
                existing.updated_at = datetime.now(timezone.utc)
                existing.updated_by = current_user.id
                updated += 1
            else:
                company = Company(
                    **{k: v for k, v in row.items()},
                    created_by=current_user.id,
                    updated_by=current_user.id,
                )
                db.add(company)
                created += 1

        except Exception as e:
            errors.append(f"ISIN {isin}: {e}")
            skipped += 1

    await db.commit()
    return IngestResult(created=created, updated=updated, skipped=skipped, errors=errors)


@router.post("/", response_model=CompanyOut, status_code=status.HTTP_201_CREATED)
async def create_company(
    body: CompanyCreate,
    current_user: User = Depends(require_permission("editor")),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(select(Company).where(Company.isin_code == body.isin_code))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"ISIN {body.isin_code} already exists")

    company = Company(**body.model_dump(), created_by=current_user.id, updated_by=current_user.id)
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

    bc = await db.execute(
        select(func.count(Beneficiary.id)).where(Beneficiary.isin_code == company.isin_code)
    )
    ic = await db.execute(
        select(func.count(GeneratedInvoice.id)).where(GeneratedInvoice.company_id == company.id)
    )
    return CompanyStats(
        beneficiary_count=bc.scalar() or 0,
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

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(company, field, value)
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

    # Cascade-delete all related data (FK constraints don't cascade automatically)
    await db.execute(delete(BenposLockin).where(BenposLockin.isin_code == isin))
    await db.execute(delete(Beneficiary).where(Beneficiary.isin_code == isin))
    await db.execute(delete(GeneratedInvoice).where(GeneratedInvoice.company_id == company.id))

    await db.delete(company)
    await db.commit()
