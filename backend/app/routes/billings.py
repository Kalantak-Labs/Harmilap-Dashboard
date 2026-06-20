import io
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_permission
from app.models.billing import BillingInvoice, BillingPayment
from app.models.user import User
from app.schemas.billing import (
    BillingConfigOut,
    BillingConfigUpdate,
    PartyBillingListOut,
    PartySettingsOut,
    PartySettingsUpdate,
    PartySummaryOut,
    GenerateInvoiceBody,
    InvoiceNoCheck,
    RecordPaymentBody,
    BillingInvoiceOut,
    BillingPaymentOut,
)
from app.schemas.invoice import Particular
from app.services.action_log import log_action
from app.services.billing_service import (
    all_parties,
    party_for_key,
    get_config,
    get_or_create_party_settings,
    get_party_settings,
    merge_particulars,
    grand_total,
    party_financials,
    billing_invoice_conds,
    billing_payment_conds,
    invoice_no_taken,
    default_invoice_no,
    generate_pdf_bytes,
)
from app.services.s3_storage import upload_pdf, download_pdf, invoice_s3_key

router = APIRouter(prefix="/billings", tags=["billings"])


async def _party_or_404(party_key: str, db: AsyncSession) -> dict:
    try:
        return await party_for_key(party_key, db)
    except ValueError:
        raise HTTPException(404, "No company found for this RTA code")


def _stream_pdf(data: bytes, filename: str) -> StreamingResponse:
    return StreamingResponse(
        io.BytesIO(data),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/config", response_model=BillingConfigOut)
async def get_billing_config(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_permission("viewer")),
):
    cfg = await get_config(db)
    return BillingConfigOut(
        line_items=[Particular(**it) for it in (cfg.line_items or [])],
        gst_type=cfg.gst_type,
        igst_rate=cfg.igst_rate,
        cgst_rate=cfg.cgst_rate,
        sgst_rate=cfg.sgst_rate,
        invoice_date=getattr(cfg, "invoice_date", None),
        bank_accounts=getattr(cfg, "bank_accounts", None) or [],
    )


@router.put("/config")
async def update_billing_config(
    body: BillingConfigUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("editor")),
):
    cfg = await get_config(db)
    cfg.line_items = [it.model_dump() for it in body.line_items]
    cfg.gst_type = body.gst_type
    cfg.igst_rate = body.igst_rate
    cfg.cgst_rate = body.cgst_rate
    cfg.sgst_rate = body.sgst_rate
    cfg.invoice_date = body.invoice_date
    cfg.bank_accounts = body.bank_accounts[:2]
    await log_action(
        db, current_user, "update", "billing_config",
        resource_id="1", resource_label="Global billing template",
        details={"fields_updated": ["line_items", "gst", "invoice_date", "bank_accounts"]},
        request=request,
    )
    await db.commit()
    return {"ok": True}


@router.get("/parties", response_model=list[PartyBillingListOut])
async def list_billing_parties(
    search: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_permission("viewer")),
):
    parties = await all_parties(db)
    out: list[PartyBillingListOut] = []
    for party in parties.values():
        if search:
            s = search.lower()
            hay = " ".join(filter(None, [
                party["party_key"], party.get("company_name"),
                party.get("nsdl_rta_code"), party.get("cdsl_rta_code"),
            ])).lower()
            if s not in hay:
                continue
        fin = await party_financials(party, db)
        inv_conds = billing_invoice_conds(party)
        inv_count = 0
        if inv_conds:
            inv_count = len((await db.execute(
                select(BillingInvoice.id).where(or_(*inv_conds))
            )).scalars().all())
        out.append(PartyBillingListOut(
            party_key=party["party_key"],
            nsdl_rta_code=party.get("nsdl_rta_code"),
            cdsl_rta_code=party.get("cdsl_rta_code"),
            company_name=party.get("company_name"),
            isin_count=party.get("isin_units", 1),
            isins=party.get("isins", []),
            invoice_count=inv_count,
            **fin,
        ))
    out.sort(key=lambda p: (p.company_name or p.party_key).lower())
    return out


@router.get("/parties/{party_key}/settings", response_model=PartySettingsOut)
async def get_party_billing_settings(
    party_key: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_permission("viewer")),
):
    party = await _party_or_404(party_key, db)
    cfg = await get_config(db)
    settings = await get_party_settings(party, db)
    particulars = merge_particulars(cfg.line_items or [], settings.particulars if settings else None)
    total = grand_total(
        particulars, cfg.gst_type, cfg.igst_rate, cfg.cgst_rate, cfg.sgst_rate,
        party.get("isin_units", 1),
    )
    return PartySettingsOut(
        party_key=party_key,
        company_name=party.get("company_name"),
        isin_count=party.get("isin_units", 1),
        particulars=[Particular(**p) for p in particulars],
        preview_total=total,
    )


@router.put("/parties/{party_key}/settings", response_model=PartySettingsOut)
async def update_party_billing_settings(
    party_key: str,
    body: PartySettingsUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("editor")),
):
    party = await _party_or_404(party_key, db)
    cfg = await get_config(db)
    settings = await get_or_create_party_settings(party, db)
    settings.particulars = [p.model_dump() for p in body.particulars]
    settings.updated_at = datetime.now(timezone.utc)
    particulars = merge_particulars(cfg.line_items or [], settings.particulars)
    total = grand_total(
        particulars, cfg.gst_type, cfg.igst_rate, cfg.cgst_rate, cfg.sgst_rate,
        party.get("isin_units", 1),
    )
    await log_action(
        db, current_user, "update", "billing_party",
        resource_id=party_key, resource_label=party.get("company_name") or party_key,
        details={"particulars_count": len(body.particulars), "preview_total": total},
        request=request,
    )
    await db.commit()
    return PartySettingsOut(
        party_key=party_key,
        company_name=party.get("company_name"),
        isin_count=party.get("isin_units", 1),
        particulars=[Particular(**p) for p in particulars],
        preview_total=total,
    )


@router.get("/parties/{party_key}/summary", response_model=PartySummaryOut)
async def get_party_summary(
    party_key: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_permission("viewer")),
):
    party = await _party_or_404(party_key, db)
    fin = await party_financials(party, db)
    inv_conds = billing_invoice_conds(party)
    pay_conds = billing_payment_conds(party)
    invoices: list[BillingInvoice] = []
    payments: list[BillingPayment] = []
    if inv_conds:
        invoices = list((await db.execute(
            select(BillingInvoice).where(or_(*inv_conds)).order_by(BillingInvoice.generated_at.desc())
        )).scalars().all())
    if pay_conds:
        payments = list((await db.execute(
            select(BillingPayment).where(or_(*pay_conds)).order_by(BillingPayment.received_at.desc())
        )).scalars().all())
    return PartySummaryOut(
        party_key=party_key,
        company_name=party.get("company_name"),
        nsdl_rta_code=party.get("nsdl_rta_code"),
        cdsl_rta_code=party.get("cdsl_rta_code"),
        isin_count=party.get("isin_units", 1),
        invoices=[BillingInvoiceOut.model_validate(i) for i in invoices],
        payments=[BillingPaymentOut.model_validate(p) for p in payments],
        **fin,
    )


@router.get("/check-invoice-no", response_model=InvoiceNoCheck)
async def check_invoice_no(
    invoice_no: str = Query(""),
    party_key: str | None = Query(None),
    invoice_date: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_permission("viewer")),
):
    from datetime import date as date_cls
    d = date_cls.fromisoformat(invoice_date) if invoice_date else date_cls.today()
    default_no = None
    if party_key:
        try:
            party = await _party_or_404(party_key, db)
            default_no = await default_invoice_no(party, d, db)
        except HTTPException:
            pass
    trimmed = invoice_no.strip()
    if not trimmed:
        return InvoiceNoCheck(available=True, default_invoice_no=default_no)
    taken = await invoice_no_taken(trimmed, db)
    return InvoiceNoCheck(available=not taken, default_invoice_no=default_no)


@router.post("/parties/{party_key}/invoices", response_model=BillingInvoiceOut)
async def generate_invoice(
    party_key: str,
    body: GenerateInvoiceBody,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("editor")),
):
    party = await _party_or_404(party_key, db)
    cfg = await get_config(db)
    invoice_no = body.invoice_no.strip()
    if not invoice_no:
        raise HTTPException(400, "Invoice number is required")
    if await invoice_no_taken(invoice_no, db):
        suggested = await default_invoice_no(party, body.invoice_date, db)
        raise HTTPException(409, f"Invoice number '{invoice_no}' is already in use. Suggested: {suggested}")

    settings = await get_party_settings(party, db)
    particulars = merge_particulars(cfg.line_items or [], settings.particulars if settings else None)
    enabled = [p for p in particulars if p.get("enabled", True)]
    if not enabled:
        raise HTTPException(400, "At least one billing particular must be enabled")

    from app.services.pdf_generator import current_fy
    fy = current_fy(body.invoice_date)
    total = grand_total(
        particulars, cfg.gst_type, cfg.igst_rate, cfg.cgst_rate, cfg.sgst_rate,
        party.get("isin_units", 1),
    )
    label = party.get("company_name") or party_key
    filename = f"Invoice_{label}_{invoice_no.replace('/', '-')}.pdf"

    inv = BillingInvoice(
        nsdl_rta_code=party.get("nsdl_rta_code"),
        cdsl_rta_code=party.get("cdsl_rta_code"),
        invoice_no=invoice_no,
        invoice_date=body.invoice_date,
        fiscal_year=fy,
        particulars=particulars,
        gst_type=cfg.gst_type,
        igst_rate=cfg.igst_rate,
        cgst_rate=cfg.cgst_rate,
        sgst_rate=cfg.sgst_rate,
        grand_total=total,
        s3_key="pending",
        filename=filename,
        generated_by=current_user.id,
    )
    db.add(inv)
    await db.flush()

    pdf = generate_pdf_bytes(party, cfg, particulars, invoice_no, body.invoice_date)
    key = invoice_s3_key(str(inv.id), filename)
    try:
        upload_pdf(key, pdf)
    except RuntimeError as exc:
        await db.rollback()
        raise HTTPException(503, str(exc)) from exc
    inv.s3_key = key
    await log_action(
        db, current_user, "generate", "billing_invoice",
        resource_id=str(inv.id), resource_label=invoice_no,
        details={"party_key": party_key, "grand_total": total, "filename": filename},
        request=request,
    )
    await db.commit()
    await db.refresh(inv)
    return BillingInvoiceOut.model_validate(inv)


@router.get("/invoices/{invoice_id}/pdf")
async def download_billing_invoice(
    invoice_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("viewer")),
):
    inv = (await db.execute(
        select(BillingInvoice).where(BillingInvoice.id == invoice_id)
    )).scalar_one_or_none()
    if not inv:
        raise HTTPException(404, "Invoice not found")
    try:
        pdf = download_pdf(inv.s3_key)
    except RuntimeError as exc:
        raise HTTPException(503, str(exc)) from exc
    await log_action(
        db, current_user, "download", "billing_invoice",
        resource_id=str(inv.id), resource_label=inv.invoice_no,
        details={"filename": inv.filename, "redownload": True},
        request=request,
    )
    await db.commit()
    return _stream_pdf(pdf, inv.filename)


@router.post("/parties/{party_key}/payments", response_model=BillingPaymentOut)
async def record_payment(
    party_key: str,
    body: RecordPaymentBody,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("editor")),
):
    party = await _party_or_404(party_key, db)
    fin = await party_financials(party, db)
    if body.amount > fin["outstanding"] + 0.01:
        raise HTTPException(
            400,
            f"Payment amount ({body.amount}) exceeds outstanding balance ({fin['outstanding']})",
        )
    payment = BillingPayment(
        nsdl_rta_code=party.get("nsdl_rta_code"),
        cdsl_rta_code=party.get("cdsl_rta_code"),
        amount=round(body.amount, 2),
        receiving_bank=body.receiving_bank,
        reference_number=body.reference_number.strip(),
        received_at=body.received_at,
        created_by=current_user.id,
    )
    db.add(payment)
    await log_action(
        db, current_user, "create", "billing_payment",
        resource_id=party_key, resource_label=party.get("company_name") or party_key,
        details={
            "amount": payment.amount,
            "bank": payment.receiving_bank,
            "reference_number": payment.reference_number,
        },
        request=request,
    )
    await db.commit()
    await db.refresh(payment)
    return BillingPaymentOut.model_validate(payment)
