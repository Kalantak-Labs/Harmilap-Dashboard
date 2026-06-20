import io
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_permission
from app.models import Company, Beneficiary
from app.models.user import User
from app.services.pdf_generator import (
    generate_benpos_pdf,
    generate_report_pdf,
    zip_pdfs,
)
from app.services.action_log import log_action, company_label

router = APIRouter(prefix="/reports", tags=["reports"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _company_dict(c: Company) -> dict:
    return {col.name: getattr(c, col.name) for col in c.__table__.columns}


def _benef_dict(b: Beneficiary) -> dict:
    return {col.name: getattr(b, col.name) for col in b.__table__.columns}


async def _get_company(company_id: str, db: AsyncSession) -> Company:
    c = await db.get(Company, company_id)
    if not c:
        raise HTTPException(404, "Company not found")
    return c


async def _beneficiaries_for(
    isin: str, db: AsyncSession, depository: str | None = None
) -> tuple[list[dict], Optional[date]]:
    q = select(Beneficiary).where(Beneficiary.isin_code == isin)
    if depository:
        q = q.where(Beneficiary.depository == depository.upper())
    result = await db.execute(q.order_by(Beneficiary.record_date.desc()))
    rows = result.scalars().all()
    record_date = max((r.record_date for r in rows if r.record_date), default=None) if rows else None
    return [_benef_dict(b) for b in rows], record_date


def _stream_pdf(data: bytes, filename: str) -> StreamingResponse:
    return StreamingResponse(
        io.BytesIO(data),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _stream_zip(data: bytes, filename: str) -> StreamingResponse:
    return StreamingResponse(
        io.BytesIO(data),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── BENPOS ────────────────────────────────────────────────────────────────────

@router.post("/benpos/{company_id}")
async def benpos_pdf(
    company_id: str,
    request: Request,
    depository: str | None = Query(None, description="NSDL or CDSL — omit for all"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("viewer")),
):
    company = await _get_company(company_id, db)
    benefs, rd = await _beneficiaries_for(company.isin_code, db, depository)
    pdf = generate_benpos_pdf(_company_dict(company), benefs, rd, depository=depository)
    isin = company.isin_code or company_id
    suffix = f"_{depository.upper()}" if depository else ""
    filename = f"BENPOS_{isin}{suffix}.pdf"
    await log_action(
        db,
        current_user,
        "generate",
        "report",
        resource_id=str(company.id),
        resource_label=company_label(company),
        details={"report_type": "benpos", "filename": filename, "depository": depository, "beneficiary_count": len(benefs)},
        request=request,
    )
    await db.commit()
    return _stream_pdf(pdf, filename)


@router.post("/benpos-bulk")
async def benpos_bulk(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("can_download")),
):
    result = await db.execute(select(Company))
    companies = result.scalars().all()
    entries: list[tuple[str, bytes]] = []
    for c in companies:
        try:
            benefs, rd = await _beneficiaries_for(c.isin_code, db)
            pdf = generate_benpos_pdf(_company_dict(c), benefs, rd)
            entries.append((f"BENPOS_{c.isin_code or c.arn_number}.pdf", pdf))
        except Exception:
            pass
    await log_action(
        db,
        current_user,
        "generate",
        "report",
        details={"report_type": "benpos_bulk", "filename": "BENPOS_Bulk.zip", "file_count": len(entries)},
        request=request,
    )
    await db.commit()
    return _stream_zip(zip_pdfs(entries), "BENPOS_Bulk.zip")


# ── Reconciliation Report ─────────────────────────────────────────────────────

@router.post("/reconciliation/{company_id}")
async def reconciliation_pdf(
    company_id: str,
    request: Request,
    report_date: Optional[date] = None,
    ref_prefix: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("viewer")),
):
    """
    report_date : the "as on" date for the report title (customizable via query param)
    ref_prefix  : the part of the ref number before /RTAN{code} (customizable via query param)
                  e.g. ?ref_prefix=2026-27/NSDL/MAR26
    """
    company = await _get_company(company_id, db)
    _, rd = await _beneficiaries_for(company.isin_code, db)
    # report_date from query overrides the beneficiary record_date
    effective_date = report_date or rd
    pdf = generate_report_pdf(_company_dict(company), effective_date, ref_prefix=ref_prefix)
    isin = company.isin_code or company_id
    filename = f"Reconciliation_{isin}.pdf"
    await log_action(
        db,
        current_user,
        "generate",
        "report",
        resource_id=str(company.id),
        resource_label=company_label(company),
        details={
            "report_type": "reconciliation",
            "filename": filename,
            "report_date": effective_date.isoformat() if effective_date else None,
            "ref_prefix": ref_prefix,
        },
        request=request,
    )
    await db.commit()
    return _stream_pdf(pdf, filename)


@router.post("/reconciliation-bulk")
async def reconciliation_bulk(
    request: Request,
    report_date: Optional[date] = None,
    ref_prefix: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("can_download")),
):
    result = await db.execute(select(Company))
    companies = result.scalars().all()
    entries: list[tuple[str, bytes]] = []
    for c in companies:
        try:
            _, rd = await _beneficiaries_for(c.isin_code, db)
            effective_date = report_date or rd
            pdf = generate_report_pdf(_company_dict(c), effective_date, ref_prefix=ref_prefix)
            entries.append((f"Reconciliation_{c.isin_code or c.arn_number}.pdf", pdf))
        except Exception:
            pass
    await log_action(
        db,
        current_user,
        "generate",
        "report",
        details={
            "report_type": "reconciliation_bulk",
            "filename": "Reconciliation_Bulk.zip",
            "file_count": len(entries),
            "report_date": report_date.isoformat() if report_date else None,
            "ref_prefix": ref_prefix,
        },
        request=request,
    )
    await db.commit()
    return _stream_zip(zip_pdfs(entries), "Reconciliation_Bulk.zip")
