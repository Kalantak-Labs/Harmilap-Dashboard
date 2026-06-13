import io
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select, func as sql_func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_permission
from app.models import Company, Beneficiary
from app.models.invoice_config import InvoiceConfig, DEFAULT_LINE_ITEMS
from app.models.generated_invoice import GeneratedInvoice
from app.models.user import User
from app.services.pdf_generator import (
    current_fy,
    generate_benpos_pdf,
    generate_invoice_pdf,
    generate_report_pdf,
    zip_pdfs,
)

router = APIRouter(prefix="/reports", tags=["reports"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _company_dict(c: Company) -> dict:
    return {col.name: getattr(c, col.name) for col in c.__table__.columns}


def _benef_dict(b: Beneficiary) -> dict:
    return {col.name: getattr(b, col.name) for col in b.__table__.columns}


async def _get_config(db: AsyncSession) -> InvoiceConfig:
    result = await db.execute(select(InvoiceConfig).where(InvoiceConfig.id == 1))
    cfg = result.scalar_one_or_none()
    if not cfg:
        cfg = InvoiceConfig(id=1, line_items=DEFAULT_LINE_ITEMS)
        db.add(cfg)
        await db.commit()
        await db.refresh(cfg)
    return cfg


async def _get_company(company_id: str, db: AsyncSession) -> Company:
    c = await db.get(Company, company_id)
    if not c:
        raise HTTPException(404, "Company not found")
    return c


async def _beneficiaries_for(isin: str, db: AsyncSession) -> tuple[list[dict], Optional[date]]:
    result = await db.execute(
        select(Beneficiary)
        .where(Beneficiary.isin_code == isin)
        .order_by(Beneficiary.record_date.desc())
    )
    rows = result.scalars().all()
    record_date = None
    if rows:
        record_date = max((r.record_date for r in rows if r.record_date), default=None)
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


async def _next_invoice_no(company: Company, db: AsyncSession) -> str:
    """Return next sequential invoice number for this company in the current FY."""
    today = date.today()
    fy = current_fy(today)
    result = await db.execute(
        select(sql_func.count(GeneratedInvoice.id))
        .where(GeneratedInvoice.company_id == company.id)
        .where(GeneratedInvoice.fiscal_year == fy)
    )
    seq = (result.scalar() or 0) + 1
    rta = company.nsdl_rta_code or ""
    inv_no = f"RTAN{rta}/{seq}"
    db.add(GeneratedInvoice(
        company_id=company.id,
        fiscal_year=fy,
        seq_no=seq,
        invoice_no=inv_no,
    ))
    await db.commit()
    return inv_no


# ── Invoice Config ────────────────────────────────────────────────────────────

class LineItem(BaseModel):
    id: int
    description: str
    sac_code: str = "997159"
    amount: float = 0
    is_red: bool = False
    non_taxable: bool = False
    enabled: bool = True


class InvoiceConfigBody(BaseModel):
    line_items: list[LineItem]
    gst_type: str = "IGST"
    igst_rate: float = 18.0
    cgst_rate: float = 9.0
    sgst_rate: float = 9.0


@router.get("/invoice-config")
async def get_invoice_config(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    cfg = await _get_config(db)
    return {
        "line_items": cfg.line_items,
        "gst_type":   cfg.gst_type,
        "igst_rate":  cfg.igst_rate,
        "cgst_rate":  cfg.cgst_rate,
        "sgst_rate":  cfg.sgst_rate,
    }


@router.put("/invoice-config")
async def update_invoice_config(
    body: InvoiceConfigBody,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_permission("editor")),
):
    cfg = await _get_config(db)
    cfg.line_items = [it.model_dump() for it in body.line_items]
    cfg.gst_type   = body.gst_type
    cfg.igst_rate  = body.igst_rate
    cfg.cgst_rate  = body.cgst_rate
    cfg.sgst_rate  = body.sgst_rate
    await db.commit()
    return {"ok": True}


# ── BENPOS ────────────────────────────────────────────────────────────────────

@router.post("/benpos/{company_id}")
async def benpos_pdf(
    company_id: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_permission("viewer")),
):
    company = await _get_company(company_id, db)
    benefs, rd = await _beneficiaries_for(company.isin_code, db)
    pdf = generate_benpos_pdf(_company_dict(company), benefs, rd)
    isin = company.isin_code or company_id
    return _stream_pdf(pdf, f"BENPOS_{isin}.pdf")


@router.post("/benpos-bulk")
async def benpos_bulk(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_permission("can_download")),
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
    return _stream_zip(zip_pdfs(entries), "BENPOS_Bulk.zip")


# ── Reconciliation Report ─────────────────────────────────────────────────────

@router.post("/reconciliation/{company_id}")
async def reconciliation_pdf(
    company_id: str,
    report_date: Optional[date] = None,
    ref_prefix: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_permission("viewer")),
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
    return _stream_pdf(pdf, f"Reconciliation_{isin}.pdf")


@router.post("/reconciliation-bulk")
async def reconciliation_bulk(
    report_date: Optional[date] = None,
    ref_prefix: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_permission("can_download")),
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
    return _stream_zip(zip_pdfs(entries), "Reconciliation_Bulk.zip")


# ── Tax Invoice ───────────────────────────────────────────────────────────────

@router.post("/invoice/{company_id}")
async def invoice_pdf(
    company_id: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_permission("viewer")),
):
    company = await _get_company(company_id, db)
    cfg = await _get_config(db)
    cd  = _company_dict(company)
    inv_no = await _next_invoice_no(company, db)
    cfg_dict = {
        "line_items": cfg.line_items,
        "gst_type":   cfg.gst_type,
        "igst_rate":  cfg.igst_rate,
        "cgst_rate":  cfg.cgst_rate,
        "sgst_rate":  cfg.sgst_rate,
    }
    pdf = generate_invoice_pdf(cd, cfg_dict, inv_no, date.today())
    isin = company.isin_code or company_id
    return _stream_pdf(pdf, f"Invoice_{isin}.pdf")


@router.post("/invoice-bulk")
async def invoice_bulk(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_permission("can_download")),
):
    result = await db.execute(select(Company))
    companies = result.scalars().all()
    cfg = await _get_config(db)
    cfg_dict = {
        "line_items": cfg.line_items,
        "gst_type":   cfg.gst_type,
        "igst_rate":  cfg.igst_rate,
        "cgst_rate":  cfg.cgst_rate,
        "sgst_rate":  cfg.sgst_rate,
    }
    entries: list[tuple[str, bytes]] = []
    for c in companies:
        try:
            inv_no = await _next_invoice_no(c, db)
            pdf    = generate_invoice_pdf(_company_dict(c), cfg_dict, inv_no, date.today())
            entries.append((f"Invoice_{c.isin_code or c.arn_number}.pdf", pdf))
        except Exception:
            pass
    return _stream_zip(zip_pdfs(entries), "Invoices_Bulk.zip")
