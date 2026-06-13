import asyncio
import uuid
from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select, func as sql_func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_admin, require_permission
from app.models import Company, Beneficiary
from app.models.email_settings import EmailSettings, EmailTemplate
from app.models.invoice_config import InvoiceConfig, DEFAULT_LINE_ITEMS
from app.models.generated_invoice import GeneratedInvoice
from app.models.user import User
from app.services.email_service import (
    EMAIL_TYPES, TEMPLATE_VARIABLES, EmailJob, batch_send, render_template, test_connection,
)
from app.services.pdf_generator import (
    current_fy, generate_benpos_pdf, generate_invoice_pdf, generate_report_pdf,
)

router = APIRouter(prefix="/emails", tags=["emails"])


# ── Shared data helpers ───────────────────────────────────────────────────────

def _cdict(c: Company) -> dict:
    return {col.name: getattr(c, col.name) for col in c.__table__.columns}

def _bdict(b: Beneficiary) -> dict:
    return {col.name: getattr(b, col.name) for col in b.__table__.columns}

async def _beneficiaries(isin: str, db: AsyncSession) -> tuple[list[dict], Optional[date]]:
    rows = (await db.execute(
        select(Beneficiary).where(Beneficiary.isin_code == isin).order_by(Beneficiary.record_date.desc())
    )).scalars().all()
    rd = max((r.record_date for r in rows if r.record_date), default=None) if rows else None
    return [_bdict(b) for b in rows], rd

async def _invoice_config(db: AsyncSession) -> InvoiceConfig:
    cfg = (await db.execute(select(InvoiceConfig).where(InvoiceConfig.id == 1))).scalar_one_or_none()
    if not cfg:
        cfg = InvoiceConfig(id=1, line_items=DEFAULT_LINE_ITEMS)
        db.add(cfg)
        await db.commit()
        await db.refresh(cfg)
    return cfg

async def _next_inv_no(company: Company, db: AsyncSession) -> str:
    today = date.today()
    fy = current_fy(today)
    seq = ((await db.execute(
        select(sql_func.count(GeneratedInvoice.id))
        .where(GeneratedInvoice.company_id == company.id)
        .where(GeneratedInvoice.fiscal_year == fy)
    )).scalar() or 0) + 1
    rta = company.nsdl_rta_code or ""
    inv_no = f"RTAN{rta}/{seq}"
    db.add(GeneratedInvoice(company_id=company.id, fiscal_year=fy, seq_no=seq, invoice_no=inv_no))
    await db.commit()
    return inv_no

async def _get_settings(db: AsyncSession) -> EmailSettings:
    s = (await db.execute(select(EmailSettings).where(EmailSettings.id == 1))).scalar_one_or_none()
    if not s:
        s = EmailSettings(id=1, smtp_port=587, smtp_use_tls=True)
        db.add(s)
        await db.commit()
        await db.refresh(s)
    return s

def _build_context(company: Company, email_type: str, record_date: Optional[date], *,
                   report_date: Optional[date] = None,
                   ref_prefix: Optional[str] = None,
                   inv_no: Optional[str] = None) -> dict:
    today = date.today()
    rta = company.nsdl_rta_code or ""
    ctx: dict = {
        "company_name":                  company.company_name or "",
        "isin_code":                     company.isin_code or "",
        "nsdl_rta_code":                 company.nsdl_rta_code or "",
        "cdsl_rta_code":                 company.cdsl_rta_code or "",
        "rta_code":                      rta,  # legacy alias → nsdl_rta_code
        "authorized_person_name":        company.authorized_person_name or "",
        "authorized_person_designation": company.authorized_person_designation or "",
        "today":                         today.strftime("%d %B %Y"),
    }
    if email_type in ("benpos", "reconciliation"):
        d = report_date or record_date
        ctx["record_date"] = d.strftime("%d %B %Y") if d else ""
    if email_type == "reconciliation":
        prefix = ref_prefix or ""
        ctx["ref_number"] = f"{prefix}/RTAN{rta}" if prefix else f"RTAN{rta}"
    if email_type == "invoice":
        ctx["invoice_no"] = inv_no or ""
        ctx["fiscal_year"] = current_fy(today)
    return ctx


# ── Settings ──────────────────────────────────────────────────────────────────

class EmailSettingsBody(BaseModel):
    smtp_host:     str | None = None
    smtp_port:     int        = 587
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_use_tls:  bool       = True
    sender_name:   str | None = None
    sender_email:  str | None = None


class EmailSettingsOut(BaseModel):
    id:            int
    smtp_host:     str | None
    smtp_port:     int
    smtp_username: str | None
    smtp_password: str | None
    smtp_use_tls:  bool
    sender_name:   str | None
    sender_email:  str | None
    is_configured: bool

    model_config = {"from_attributes": True}


def _settings_out(s: EmailSettings) -> dict:
    return {
        **{c.name: getattr(s, c.name) for c in s.__table__.columns},
        "is_configured": bool(s.smtp_host and s.sender_email),
    }


@router.get("/settings", response_model=EmailSettingsOut)
async def get_email_settings(
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    return _settings_out(await _get_settings(db))


@router.put("/settings", response_model=EmailSettingsOut)
async def update_email_settings(
    body: EmailSettingsBody,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    s = await _get_settings(db)
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(s, field, value)
    s.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(s)
    return _settings_out(s)


@router.post("/settings/test")
async def test_smtp(
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    s = await _get_settings(db)
    if not s.smtp_host:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "SMTP host is not configured")
    err = await test_connection(s)
    if err:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Connection failed: {err}")
    return {"ok": True, "message": "Connection successful"}


# ── Variables catalog ─────────────────────────────────────────────────────────

@router.get("/variables")
async def get_variables(_: User = Depends(get_current_user)):
    return TEMPLATE_VARIABLES


# ── Templates ─────────────────────────────────────────────────────────────────

class TemplateCreate(BaseModel):
    email_type: str
    name:       str
    subject:    str
    body:       str
    is_default: bool = False


class TemplateUpdate(BaseModel):
    name:       str | None  = None
    subject:    str | None  = None
    body:       str | None  = None
    is_default: bool | None = None


class TemplateOut(BaseModel):
    id:         uuid.UUID
    email_type: str
    name:       str
    subject:    str
    body:       str
    is_default: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


async def _clear_defaults(email_type: str, db: AsyncSession) -> None:
    for t in (await db.execute(
        select(EmailTemplate).where(EmailTemplate.email_type == email_type, EmailTemplate.is_default == True)
    )).scalars().all():
        t.is_default = False
    await db.flush()


@router.get("/templates", response_model=list[TemplateOut])
async def list_templates(
    email_type: str | None = None,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(EmailTemplate).order_by(EmailTemplate.email_type, EmailTemplate.name)
    if email_type:
        q = q.where(EmailTemplate.email_type == email_type)
    return (await db.execute(q)).scalars().all()


@router.post("/templates", response_model=TemplateOut, status_code=status.HTTP_201_CREATED)
async def create_template(
    body: TemplateCreate,
    _: User = Depends(require_permission("editor")),
    db: AsyncSession = Depends(get_db),
):
    if body.email_type not in EMAIL_TYPES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            f"Invalid email_type. Must be one of: {EMAIL_TYPES}")
    if body.is_default:
        await _clear_defaults(body.email_type, db)
    t = EmailTemplate(**body.model_dump())
    db.add(t)
    await db.commit()
    await db.refresh(t)
    return t


@router.patch("/templates/{tid}", response_model=TemplateOut)
async def update_template(
    tid: uuid.UUID,
    body: TemplateUpdate,
    _: User = Depends(require_permission("editor")),
    db: AsyncSession = Depends(get_db),
):
    t = (await db.execute(select(EmailTemplate).where(EmailTemplate.id == tid))).scalar_one_or_none()
    if not t:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Template not found")
    if body.is_default:
        await _clear_defaults(t.email_type, db)
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(t, field, value)
    t.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(t)
    return t


@router.delete("/templates/{tid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(
    tid: uuid.UUID,
    _: User = Depends(require_permission("editor")),
    db: AsyncSession = Depends(get_db),
):
    t = (await db.execute(select(EmailTemplate).where(EmailTemplate.id == tid))).scalar_one_or_none()
    if not t:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Template not found")
    await db.delete(t)
    await db.commit()


# ── Preview ───────────────────────────────────────────────────────────────────

@router.get("/preview/{tid}")
async def preview_template(
    tid: uuid.UUID,
    company_id: str,
    report_date: Optional[date] = None,
    ref_prefix: Optional[str] = None,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    t = (await db.execute(select(EmailTemplate).where(EmailTemplate.id == tid))).scalar_one_or_none()
    if not t:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Template not found")
    company = await db.get(Company, company_id)
    if not company:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Company not found")
    _, rd = await _beneficiaries(company.isin_code, db)
    ctx = _build_context(company, t.email_type, rd, report_date=report_date, ref_prefix=ref_prefix)
    return {
        "subject": render_template(t.subject, ctx),
        "body":    render_template(t.body, ctx),
        "to":      company.email_ids or [],
    }


# ── Send ──────────────────────────────────────────────────────────────────────

class SendBody(BaseModel):
    email_type:   str
    template_id:  uuid.UUID
    company_ids:  list[uuid.UUID]
    report_date:  Optional[date] = None
    ref_prefix:   Optional[str]  = None


class SendResultItem(BaseModel):
    company_id:   str
    company_name: str | None
    emails:       list[str]
    status:       str           # sent | failed | no_email
    error:        str | None = None


class SendResponse(BaseModel):
    sent:     int
    failed:   int
    no_email: int
    results:  list[SendResultItem]


@router.post("/send", response_model=SendResponse)
async def send_emails_endpoint(
    body: SendBody,
    _: User = Depends(require_permission("can_download")),
    db: AsyncSession = Depends(get_db),
):
    s = await _get_settings(db)
    if not s.smtp_host or not s.sender_email:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            "Email not configured — go to Email → Settings first")

    tmpl = (await db.execute(
        select(EmailTemplate).where(EmailTemplate.id == body.template_id)
    )).scalar_one_or_none()
    if not tmpl:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Template not found")
    if tmpl.email_type != body.email_type:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            "Template type does not match the selected email type")

    cfg = await _invoice_config(db) if body.email_type == "invoice" else None
    cfg_dict = ({"line_items": cfg.line_items, "gst_type": cfg.gst_type,
                 "igst_rate": cfg.igst_rate, "cgst_rate": cfg.cgst_rate,
                 "sgst_rate": cfg.sgst_rate} if cfg else None)

    # ── Phase 1 (async): prepare all emails, generate PDFs, allocate invoice nos ──
    results: list[dict] = []
    jobs: list[EmailJob] = []

    for cid in body.company_ids:
        company = await db.get(Company, str(cid))
        if not company:
            results.append({"company_id": str(cid), "company_name": None,
                            "emails": [], "status": "failed", "error": "Company not found"})
            continue

        to_emails = [e.strip() for e in (company.email_ids or []) if e and "@" in e]
        if not to_emails:
            results.append({"company_id": str(cid), "company_name": company.company_name,
                            "emails": [], "status": "no_email",
                            "error": "No email address on file"})
            continue

        try:
            benefs, rd = await _beneficiaries(company.isin_code, db)
            effective_date = body.report_date or rd
            inv_no: str | None = None
            key = company.isin_code or company.arn_number

            if body.email_type == "benpos":
                pdf_bytes = generate_benpos_pdf(_cdict(company), benefs, rd)
                filename = f"BENPOS_{key}.pdf"
            elif body.email_type == "reconciliation":
                pdf_bytes = generate_report_pdf(_cdict(company), effective_date,
                                                ref_prefix=body.ref_prefix)
                filename = f"Reconciliation_{key}.pdf"
            else:  # invoice
                inv_no = await _next_inv_no(company, db)
                pdf_bytes = generate_invoice_pdf(_cdict(company), cfg_dict, inv_no, date.today())
                filename = f"Invoice_{key}.pdf"

            ctx = _build_context(company, body.email_type, rd,
                                 report_date=effective_date, ref_prefix=body.ref_prefix,
                                 inv_no=inv_no)
            jobs.append(EmailJob(
                company_id=str(cid),
                company_name=company.company_name,
                to_emails=to_emails,
                subject=render_template(tmpl.subject, ctx),
                body=render_template(tmpl.body, ctx),
                pdf_bytes=pdf_bytes,
                filename=filename,
            ))

        except Exception as exc:
            results.append({"company_id": str(cid), "company_name": company.company_name,
                            "emails": to_emails, "status": "failed",
                            "error": f"PDF generation failed: {exc}"})

    # ── Phase 2 (thread): send entire batch over one SMTP connection ──────────
    if jobs:
        loop = asyncio.get_running_loop()
        statuses = await loop.run_in_executor(None, batch_send, s, jobs)
        for job, err in zip(jobs, statuses):
            if err is None:
                results.append({"company_id": job.company_id, "company_name": job.company_name,
                                 "emails": job.to_emails, "status": "sent"})
            else:
                results.append({"company_id": job.company_id, "company_name": job.company_name,
                                 "emails": job.to_emails, "status": "failed", "error": err})

    sent     = sum(1 for r in results if r["status"] == "sent")
    failed   = sum(1 for r in results if r["status"] == "failed")
    no_email = sum(1 for r in results if r["status"] == "no_email")
    return SendResponse(sent=sent, failed=failed, no_email=no_email, results=results)
