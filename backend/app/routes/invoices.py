import io
from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select, or_, func as sql_func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_permission
from app.models import Company, Invoice
from app.models.invoice_config import InvoiceConfig, DEFAULT_LINE_ITEMS
from app.models.user import User
from app.schemas.invoice import (
    InvoiceOut, InvoiceUpdate, PartyListOut, Particular,
)
from app.services.invoice_excel import build_invoice_export, parse_invoice_excel
from app.services.pdf_generator import current_fy, generate_invoice_pdf, zip_pdfs

router = APIRouter(prefix="/invoices", tags=["invoices"])


# ── Config (particulars template + GST defaults) ──────────────────────────────

async def _get_config(db: AsyncSession) -> InvoiceConfig:
    cfg = (await db.execute(select(InvoiceConfig).where(InvoiceConfig.id == 1))).scalar_one_or_none()
    if not cfg:
        cfg = InvoiceConfig(id=1, line_items=DEFAULT_LINE_ITEMS)
        db.add(cfg)
        await db.commit()
        await db.refresh(cfg)
    return cfg


def _cfg_invoice_date(cfg: InvoiceConfig) -> date:
    return getattr(cfg, "invoice_date", None) or date.today()


def _cfg_fy(cfg: InvoiceConfig) -> str:
    return current_fy(_cfg_invoice_date(cfg))


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
    invoice_date: date | None = None


@router.get("/config")
async def get_config(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_permission("viewer")),
):
    cfg = await _get_config(db)
    return {
        "line_items": cfg.line_items, "gst_type": cfg.gst_type,
        "igst_rate": cfg.igst_rate, "cgst_rate": cfg.cgst_rate, "sgst_rate": cfg.sgst_rate,
        "invoice_date": getattr(cfg, "invoice_date", None),
    }


@router.put("/config")
async def update_config(
    body: InvoiceConfigBody,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_permission("editor")),
):
    cfg = await _get_config(db)
    cfg.line_items = [it.model_dump() for it in body.line_items]
    cfg.gst_type = body.gst_type
    cfg.igst_rate = body.igst_rate
    cfg.cgst_rate = body.cgst_rate
    cfg.sgst_rate = body.sgst_rate
    cfg.invoice_date = body.invoice_date
    await db.commit()
    return {"ok": True}


# ── Party derivation (companies grouped by RTA code) ──────────────────────────

def _party_key(c: Company) -> str | None:
    return c.nsdl_rta_code or c.cdsl_rta_code or None


def _rep_score(c: Company) -> int:
    """Higher = more complete; used to pick a representative company per party."""
    fields = [c.company_name, c.pan_number, c.gst_number, c.reg_address_line1,
              c.reg_city, c.reg_pin_code, c.billing_address]
    return sum(1 for f in fields if f)


def _isin_units(rows: list[Company]) -> int:
    """Chargeable ISIN units: an ISIN active in both NSDL and CDSL counts as 2."""
    units = 0
    for r in rows:
        if not r.isin_code:
            continue
        units += 2 if (r.has_nsdl_shares and r.has_cdsl_shares) else 1
    return units or 1  # never zero — an ARN-only party is still one unit


async def _all_parties(db: AsyncSession) -> dict[str, dict]:
    """Group every company carrying an RTA code into parties keyed by party_key."""
    companies = (await db.execute(select(Company))).scalars().all()
    groups: dict[str, list[Company]] = {}
    for c in companies:
        key = _party_key(c)
        if not key:
            continue
        groups.setdefault(key, []).append(c)

    parties: dict[str, dict] = {}
    for key, rows in groups.items():
        rep = max(rows, key=_rep_score)
        nsdl = next((r.nsdl_rta_code for r in rows if r.nsdl_rta_code), None)
        cdsl = next((r.cdsl_rta_code for r in rows if r.cdsl_rta_code), None)
        isins = sorted({r.isin_code for r in rows if r.isin_code})
        parties[key] = {
            "party_key": key,
            "nsdl_rta_code": nsdl,
            "cdsl_rta_code": cdsl,
            "company_name": rep.company_name,
            "pan_number": rep.pan_number,
            "gst_number": rep.gst_number,
            "billing_address": rep.billing_address,
            "reg_address_line1": rep.reg_address_line1,
            "reg_address_line2": rep.reg_address_line2,
            "reg_address_line3": rep.reg_address_line3,
            "reg_address_line4": rep.reg_address_line4,
            "reg_city": rep.reg_city,
            "reg_pin_code": rep.reg_pin_code,
            "isins": isins,
            "isin_units": _isin_units(rows),
        }
    return parties


async def _party_for_key(party_key: str, db: AsyncSession) -> dict:
    rows = (await db.execute(
        select(Company).where(
            or_(Company.nsdl_rta_code == party_key, Company.cdsl_rta_code == party_key)
        )
    )).scalars().all()
    if not rows:
        raise HTTPException(404, "No company found for this RTA code")
    rep = max(rows, key=_rep_score)
    return {
        "party_key": party_key,
        "nsdl_rta_code": next((r.nsdl_rta_code for r in rows if r.nsdl_rta_code), None),
        "cdsl_rta_code": next((r.cdsl_rta_code for r in rows if r.cdsl_rta_code), None),
        "company_name": rep.company_name,
        "pan_number": rep.pan_number,
        "gst_number": rep.gst_number,
        "billing_address": rep.billing_address,
        "reg_address_line1": rep.reg_address_line1,
        "reg_address_line2": rep.reg_address_line2,
        "reg_address_line3": rep.reg_address_line3,
        "reg_address_line4": rep.reg_address_line4,
        "reg_city": rep.reg_city,
        "reg_pin_code": rep.reg_pin_code,
        "isins": sorted({r.isin_code for r in rows if r.isin_code}),
        "isin_units": _isin_units(rows),
    }


# ── Invoice record helpers ────────────────────────────────────────────────────

async def _find_invoice(party: dict, fy: str, db: AsyncSession) -> Optional[Invoice]:
    conds = []
    if party.get("nsdl_rta_code"):
        conds.append(Invoice.nsdl_rta_code == party["nsdl_rta_code"])
    if party.get("cdsl_rta_code"):
        conds.append(Invoice.cdsl_rta_code == party["cdsl_rta_code"])
    if not conds:
        return None
    return (await db.execute(
        select(Invoice).where(Invoice.fiscal_year == fy, or_(*conds))
    )).scalar_one_or_none()


def _grand_total(particulars: list[dict], gst_type: str,
                 igst_rate: float, cgst_rate: float, sgst_rate: float,
                 units: int = 1) -> float:
    """Particular amounts are per-ISIN; multiply by chargeable units."""
    enabled = [p for p in particulars if p.get("enabled", True)]
    taxable = sum(float(p.get("amount") or 0) for p in enabled if not p.get("non_taxable")) * units
    non_taxable = sum(float(p.get("amount") or 0) for p in enabled if p.get("non_taxable")) * units
    if gst_type == "IGST":
        gst = round(taxable * igst_rate / 100)
    else:
        gst = round(taxable * cgst_rate / 100) + round(taxable * sgst_rate / 100)
    return taxable + non_taxable + gst


def _seed_particulars(cfg: InvoiceConfig) -> list[dict]:
    return [dict(it) for it in (cfg.line_items or [])]


def _party_code(party: dict) -> str:
    """RTA code for the invoice number — NSDL preferred, else CDSL."""
    return party.get("nsdl_rta_code") or party.get("cdsl_rta_code") or ""


async def _next_invoice_no(party: dict, fy: str, db: AsyncSession) -> str:
    """Format: <financial year>/<rta code>/<serial>, e.g. 2026-27/4369/1."""
    seq = ((await db.execute(
        select(sql_func.count(Invoice.id)).where(Invoice.fiscal_year == fy)
    )).scalar() or 0) + 1
    return f"{fy}/{_party_code(party)}/{seq}"


def _build_out(party: dict, inv: Optional[Invoice], cfg: InvoiceConfig) -> InvoiceOut:
    units = party.get("isin_units", 1)
    if inv:
        particulars = inv.particulars or []
        gst_type, igst, cgst, sgst = inv.gst_type, inv.igst_rate, inv.cgst_rate, inv.sgst_rate
        invoice_no, fy = inv.invoice_no, inv.fiscal_year
        pay_status, pay_date, amt_paid = inv.payment_status, inv.payment_date, inv.amount_paid
        last_gen = inv.last_generated_at
    else:
        particulars = _seed_particulars(cfg)
        gst_type, igst, cgst, sgst = cfg.gst_type, cfg.igst_rate, cfg.cgst_rate, cfg.sgst_rate
        invoice_no, fy = None, _cfg_fy(cfg)
        pay_status, pay_date, amt_paid = False, None, None
        last_gen = None

    return InvoiceOut(
        id=inv.id if inv else None,
        party_key=party["party_key"],
        nsdl_rta_code=party.get("nsdl_rta_code"),
        cdsl_rta_code=party.get("cdsl_rta_code"),
        company_name=party.get("company_name"),
        pan_number=party.get("pan_number"),
        gst_number=party.get("gst_number"),
        billing_address=party.get("billing_address"),
        isins=party.get("isins", []),
        isin_count=units,
        particulars=[Particular(**p) for p in particulars],
        gst_type=gst_type, igst_rate=igst, cgst_rate=cgst, sgst_rate=sgst,
        invoice_no=invoice_no, invoice_date=_cfg_invoice_date(cfg), fiscal_year=fy,
        payment_status=pay_status, payment_date=pay_date, amount_paid=amt_paid,
        last_generated_at=last_gen,
        grand_total=_grand_total(particulars, gst_type, igst, cgst, sgst, units),
    )


def _company_dict_for_pdf(party: dict) -> dict:
    return {
        "company_name": party.get("company_name"),
        "gst_number": party.get("gst_number"),
        "pan_number": party.get("pan_number"),
        "billing_address": party.get("billing_address"),
        "reg_address_line1": party.get("reg_address_line1"),
        "reg_address_line2": party.get("reg_address_line2"),
        "reg_address_line3": party.get("reg_address_line3"),
        "reg_address_line4": party.get("reg_address_line4"),
        "reg_city": party.get("reg_city"),
        "reg_pin_code": party.get("reg_pin_code"),
        "nsdl_rta_code": party.get("nsdl_rta_code"),
        "cdsl_rta_code": party.get("cdsl_rta_code"),
        "isins": party.get("isins", []),
        "isin_units": party.get("isin_units", 1),
    }


def _pdf_for(party: dict, inv: Optional[Invoice], cfg: InvoiceConfig) -> bytes:
    out = _build_out(party, inv, cfg)
    units = party.get("isin_units", 1)
    # Particular amounts are per-ISIN — scale to the chargeable units for the invoice.
    line_items = []
    for p in out.particulars:
        d = p.model_dump()
        d["amount"] = (d.get("amount") or 0) * units
        line_items.append(d)
    config = {
        "line_items": line_items,
        "gst_type": out.gst_type, "igst_rate": out.igst_rate,
        "cgst_rate": out.cgst_rate, "sgst_rate": out.sgst_rate,
    }
    inv_no = out.invoice_no or f"{out.fiscal_year}/{_party_code(party)}/1"
    return generate_invoice_pdf(_company_dict_for_pdf(party), config, inv_no, _cfg_invoice_date(cfg))


async def _ensure_record(party: dict, cfg: InvoiceConfig, db: AsyncSession) -> Invoice:
    """Find the party's invoice for the configured FY, creating it (with number) if absent."""
    fy = _cfg_fy(cfg)
    inv = await _find_invoice(party, fy, db)
    if not inv:
        inv = Invoice(
            nsdl_rta_code=party.get("nsdl_rta_code"),
            cdsl_rta_code=party.get("cdsl_rta_code"),
            particulars=_seed_particulars(cfg),
            gst_type=cfg.gst_type, igst_rate=cfg.igst_rate,
            cgst_rate=cfg.cgst_rate, sgst_rate=cfg.sgst_rate,
            fiscal_year=fy,
            invoice_no=await _next_invoice_no(party, fy, db),
        )
        db.add(inv)
    elif not inv.invoice_no:
        inv.invoice_no = await _next_invoice_no(party, fy, db)
    return inv


async def _generate_and_stamp(party: dict, cfg: InvoiceConfig, db: AsyncSession) -> tuple[str, bytes]:
    """Persist the invoice (number + last_generated_at) and render the PDF."""
    inv = await _ensure_record(party, cfg, db)
    inv.last_generated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(inv)
    pdf = _pdf_for(party, inv, cfg)
    label = party.get("company_name") or party["party_key"]
    return f"Invoice_{label}.pdf", pdf


def _stream_pdf(data: bytes, filename: str) -> StreamingResponse:
    return StreamingResponse(io.BytesIO(data), media_type="application/pdf",
                             headers={"Content-Disposition": f'attachment; filename="{filename}"'})


def _stream_zip(data: bytes, filename: str, summary: dict | None = None) -> StreamingResponse:
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    if summary:
        headers["X-Import-Summary"] = ",".join(f"{k}={v}" for k, v in summary.items())
    return StreamingResponse(io.BytesIO(data), media_type="application/zip", headers=headers)


# ── Party list ────────────────────────────────────────────────────────────────

@router.get("/parties", response_model=list[PartyListOut])
async def list_parties(
    search: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_permission("viewer")),
):
    cfg = await _get_config(db)
    fy = _cfg_fy(cfg)
    parties = await _all_parties(db)
    invoices = (await db.execute(
        select(Invoice).where(Invoice.fiscal_year == fy)
    )).scalars().all()

    def match_inv(party: dict) -> Optional[Invoice]:
        for iv in invoices:
            if party.get("nsdl_rta_code") and iv.nsdl_rta_code == party["nsdl_rta_code"]:
                return iv
            if party.get("cdsl_rta_code") and iv.cdsl_rta_code == party["cdsl_rta_code"]:
                return iv
        return None

    out: list[PartyListOut] = []
    for party in parties.values():
        if search:
            s = search.lower()
            hay = " ".join(filter(None, [
                party["party_key"], party.get("company_name"),
                party.get("nsdl_rta_code"), party.get("cdsl_rta_code"),
            ])).lower()
            if s not in hay:
                continue
        iv = match_inv(party)
        built = _build_out(party, iv, cfg)
        out.append(PartyListOut(
            party_key=party["party_key"],
            nsdl_rta_code=party.get("nsdl_rta_code"),
            cdsl_rta_code=party.get("cdsl_rta_code"),
            company_name=party.get("company_name"),
            isin_count=party.get("isin_units", 1),
            isins=party.get("isins", []),
            invoice_no=built.invoice_no,
            grand_total=built.grand_total,
            payment_status=built.payment_status,
            payment_date=built.payment_date,
            amount_paid=built.amount_paid,
            last_generated_at=built.last_generated_at,
            has_record=iv is not None,
        ))
    out.sort(key=lambda p: (p.company_name or p.party_key or "").lower())
    return out


@router.get("/parties/{party_key}", response_model=InvoiceOut)
async def get_invoice(
    party_key: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_permission("viewer")),
):
    cfg = await _get_config(db)
    party = await _party_for_key(party_key, db)
    inv = await _find_invoice(party, _cfg_fy(cfg), db)
    return _build_out(party, inv, cfg)


@router.put("/parties/{party_key}", response_model=InvoiceOut)
async def upsert_invoice(
    party_key: str,
    body: InvoiceUpdate,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_permission("editor")),
):
    cfg = await _get_config(db)
    party = await _party_for_key(party_key, db)
    inv = await _ensure_record(party, cfg, db)

    if body.particulars is not None:
        inv.particulars = [p.model_dump() for p in body.particulars]
    if body.gst_type is not None:
        inv.gst_type = body.gst_type
    if body.igst_rate is not None:
        inv.igst_rate = body.igst_rate
    if body.cgst_rate is not None:
        inv.cgst_rate = body.cgst_rate
    if body.sgst_rate is not None:
        inv.sgst_rate = body.sgst_rate
    if body.payment_status is not None:
        inv.payment_status = body.payment_status
    if body.payment_date is not None:
        inv.payment_date = body.payment_date
    if body.amount_paid is not None:
        inv.amount_paid = body.amount_paid

    await db.commit()
    await db.refresh(inv)
    return _build_out(party, inv, cfg)


# ── PDF generation ────────────────────────────────────────────────────────────

@router.post("/parties/{party_key}/pdf")
async def invoice_pdf(
    party_key: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_permission("viewer")),
):
    cfg = await _get_config(db)
    party = await _party_for_key(party_key, db)
    filename, pdf = await _generate_and_stamp(party, cfg, db)
    return _stream_pdf(pdf, filename)


@router.post("/bulk-pdf")
async def invoice_bulk(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_permission("can_download")),
):
    cfg = await _get_config(db)
    parties = await _all_parties(db)
    entries: list[tuple[str, bytes]] = []
    for party in parties.values():
        try:
            entries.append(await _generate_and_stamp(party, cfg, db))
        except Exception:
            pass
    return _stream_zip(zip_pdfs(entries), "Invoices_Bulk.zip")


# ── Excel export / import ─────────────────────────────────────────────────────

@router.get("/export")
async def export_invoices(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_permission("can_download")),
):
    cfg = await _get_config(db)
    fy = _cfg_fy(cfg)
    parties = await _all_parties(db)
    invoices = (await db.execute(select(Invoice).where(Invoice.fiscal_year == fy))).scalars().all()
    particular_names = [it.get("description", "") for it in (cfg.line_items or [])]

    rows: list[dict] = []
    for party in parties.values():
        iv = next((i for i in invoices if
                   (party.get("nsdl_rta_code") and i.nsdl_rta_code == party["nsdl_rta_code"]) or
                   (party.get("cdsl_rta_code") and i.cdsl_rta_code == party["cdsl_rta_code"])), None)
        built = _build_out(party, iv, cfg)
        amounts = {p.description: p.amount for p in built.particulars}
        rows.append({
            "nsdl_rta_code": party.get("nsdl_rta_code"),
            "cdsl_rta_code": party.get("cdsl_rta_code"),
            "company_name": party.get("company_name"),
            "invoice_no": built.invoice_no,
            "particular_amounts": amounts,
            "payment_status": built.payment_status,
            "payment_date": built.payment_date,
            "amount_paid": built.amount_paid,
        })
    data = build_invoice_export(rows, particular_names)
    return StreamingResponse(
        io.BytesIO(data),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="Invoices.xlsx"'},
    )


@router.post("/import-zip")
async def import_invoices_zip(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_permission("can_download")),
):
    cfg = await _get_config(db)
    particular_names = [it.get("description", "") for it in (cfg.line_items or [])]
    content = await file.read()
    rows, errors = parse_invoice_excel(content, particular_names)

    created = updated = 0
    entries: list[tuple[str, bytes]] = []

    for row in rows:
        key = row.get("nsdl_rta_code") or row.get("cdsl_rta_code")
        try:
            party = await _party_for_key(key, db)
        except HTTPException:
            errors.append(f"RTA code {key}: no matching company, skipped.")
            continue

        existed = await _find_invoice(party, _cfg_fy(cfg), db) is not None
        inv = await _ensure_record(party, cfg, db)
        if existed:
            updated += 1
        else:
            created += 1

        # Apply per-particular amounts matched by description
        amounts = row.get("particular_amounts") or {}
        particulars = [dict(p) for p in (inv.particulars or _seed_particulars(cfg))]
        for p in particulars:
            if p.get("description") in amounts:
                p["amount"] = amounts[p["description"]]
        inv.particulars = particulars
        if row.get("payment_status") is not None:
            inv.payment_status = row["payment_status"]
        if row.get("payment_date") is not None:
            inv.payment_date = row["payment_date"]
        if row.get("amount_paid") is not None:
            inv.amount_paid = row["amount_paid"]
        inv.last_generated_at = datetime.now(timezone.utc)

        await db.commit()
        await db.refresh(inv)

        pdf = _pdf_for(party, inv, cfg)
        label = party.get("company_name") or key
        entries.append((f"Invoice_{label}.pdf", pdf))

    if errors:
        entries.append(("_errors.txt", "\n".join(errors).encode("utf-8")))

    summary = {"created": created, "updated": updated,
               "generated": len(entries) - (1 if errors else 0), "errors": len(errors)}
    return _stream_zip(zip_pdfs(entries), "Invoices.zip", summary)
