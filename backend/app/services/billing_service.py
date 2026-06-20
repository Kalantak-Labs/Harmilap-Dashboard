"""Shared billing logic: party grouping, totals, particulars merge, PDF payload."""

from datetime import date
from typing import Optional

from sqlalchemy import select, or_, func as sql_func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Company
from app.models.billing import BillingInvoice, BillingPartySettings, BillingPayment
from app.models.invoice_config import InvoiceConfig, DEFAULT_LINE_ITEMS
from app.services.pdf_generator import current_fy, generate_invoice_pdf


def grand_total(
    particulars: list[dict],
    gst_type: str,
    igst_rate: float,
    cgst_rate: float,
    sgst_rate: float,
    units: int = 1,
) -> float:
    enabled = [p for p in particulars if p.get("enabled", True)]
    taxable = sum(float(p.get("amount") or 0) for p in enabled if not p.get("non_taxable")) * units
    non_taxable = sum(float(p.get("amount") or 0) for p in enabled if p.get("non_taxable"))
    if gst_type == "IGST":
        gst = round(taxable * igst_rate / 100)
    else:
        gst = round(taxable * cgst_rate / 100) + round(taxable * sgst_rate / 100)
    return round(taxable + non_taxable + gst)


def party_code(party: dict) -> str:
    return (party.get("nsdl_rta_code") or party.get("cdsl_rta_code") or "").strip()


def rep_score(c: Company) -> int:
    fields = [c.company_name, c.pan_number, c.gst_number, c.reg_address_line1,
              c.reg_city, c.reg_pin_code, c.billing_address]
    return sum(1 for f in fields if f)


def isin_units(rows: list[Company]) -> int:
    units = 0
    for r in rows:
        if not r.isin_code:
            continue
        units += 2 if (r.has_nsdl_shares and r.has_cdsl_shares) else 1
    return units or 1


def party_key(c: Company) -> str | None:
    return c.nsdl_rta_code or c.cdsl_rta_code or None


async def all_parties(db: AsyncSession) -> dict[str, dict]:
    companies = (await db.execute(select(Company))).scalars().all()
    groups: dict[str, list[Company]] = {}
    for c in companies:
        key = party_key(c)
        if not key:
            continue
        groups.setdefault(key, []).append(c)

    parties: dict[str, dict] = {}
    for key, rows in groups.items():
        rep = max(rows, key=rep_score)
        nsdl = next((r.nsdl_rta_code for r in rows if r.nsdl_rta_code), None)
        cdsl = next((r.cdsl_rta_code for r in rows if r.cdsl_rta_code), None)
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
            "isins": sorted({r.isin_code for r in rows if r.isin_code}),
            "isin_units": isin_units(rows),
        }
    return parties


async def party_for_key(party_key: str, db: AsyncSession) -> dict:
    rows = (await db.execute(
        select(Company).where(
            or_(Company.nsdl_rta_code == party_key, Company.cdsl_rta_code == party_key)
        )
    )).scalars().all()
    if not rows:
        raise ValueError("No company found for this RTA code")
    rep = max(rows, key=rep_score)
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
        "isin_units": isin_units(rows),
    }


def _party_conds(party: dict):
    conds = []
    if party.get("nsdl_rta_code"):
        conds.append(BillingPartySettings.nsdl_rta_code == party["nsdl_rta_code"])
    if party.get("cdsl_rta_code"):
        conds.append(BillingPartySettings.cdsl_rta_code == party["cdsl_rta_code"])
    return conds


async def get_party_settings(party: dict, db: AsyncSession) -> BillingPartySettings | None:
    conds = _party_conds(party)
    if not conds:
        return None
    return (await db.execute(
        select(BillingPartySettings).where(or_(*conds))
    )).scalar_one_or_none()


async def get_or_create_party_settings(party: dict, db: AsyncSession) -> BillingPartySettings:
    existing = await get_party_settings(party, db)
    if existing:
        return existing
    row = BillingPartySettings(
        nsdl_rta_code=party.get("nsdl_rta_code"),
        cdsl_rta_code=party.get("cdsl_rta_code"),
        particulars=None,
    )
    db.add(row)
    await db.flush()
    return row


def merge_particulars(global_items: list[dict], party_items: list[dict] | None) -> list[dict]:
    """Start from global template; overlay party prices/descriptions/enabled flags by id."""
    base = [dict(it) for it in (global_items or DEFAULT_LINE_ITEMS)]
    if not party_items:
        return base
    by_id = {int(p["id"]): p for p in party_items if p.get("id") is not None}
    merged = []
    for item in base:
        pid = int(item["id"])
        if pid in by_id:
            override = by_id[pid]
            merged.append({
                **item,
                "description": override.get("description", item.get("description", "")),
                "amount": float(override.get("amount", item.get("amount", 0)) or 0),
                "enabled": override.get("enabled", item.get("enabled", True)),
                "non_taxable": override.get("non_taxable", item.get("non_taxable", False)),
                "is_red": override.get("is_red", item.get("is_red", False)),
                "sac_code": override.get("sac_code", item.get("sac_code", "997159")),
            })
        else:
            merged.append(dict(item))
    extra_ids = sorted(set(by_id) - {int(i["id"]) for i in base})
    for eid in extra_ids:
        merged.append(dict(by_id[eid]))
    return merged


def billing_invoice_conds(party: dict):
    conds = []
    if party.get("nsdl_rta_code"):
        conds.append(BillingInvoice.nsdl_rta_code == party["nsdl_rta_code"])
    if party.get("cdsl_rta_code"):
        conds.append(BillingInvoice.cdsl_rta_code == party["cdsl_rta_code"])
    return conds


def billing_payment_conds(party: dict):
    conds = []
    if party.get("nsdl_rta_code"):
        conds.append(BillingPayment.nsdl_rta_code == party["nsdl_rta_code"])
    if party.get("cdsl_rta_code"):
        conds.append(BillingPayment.cdsl_rta_code == party["cdsl_rta_code"])
    return conds


async def party_financials(party: dict, db: AsyncSession) -> dict:
    inv_conds = billing_invoice_conds(party)
    pay_conds = billing_payment_conds(party)
    total_billed = 0.0
    total_received = 0.0
    if inv_conds:
        total_billed = float((await db.execute(
            select(sql_func.coalesce(sql_func.sum(BillingInvoice.grand_total), 0)).where(or_(*inv_conds))
        )).scalar() or 0)
    if pay_conds:
        total_received = float((await db.execute(
            select(sql_func.coalesce(sql_func.sum(BillingPayment.amount), 0)).where(or_(*pay_conds))
        )).scalar() or 0)
    outstanding = round(total_billed - total_received, 2)
    return {
        "total_billed": round(total_billed, 2),
        "total_received": round(total_received, 2),
        "outstanding": outstanding,
    }


async def invoice_no_taken(invoice_no: str, db: AsyncSession) -> bool:
    no = invoice_no.strip()
    if not no:
        return False
    return (await db.execute(
        select(BillingInvoice.id).where(BillingInvoice.invoice_no == no)
    )).scalar_one_or_none() is not None


async def default_invoice_no(party: dict, invoice_date: date, db: AsyncSession) -> str:
    fy = current_fy(invoice_date)
    seq = ((await db.execute(
        select(sql_func.count(BillingInvoice.id)).where(BillingInvoice.fiscal_year == fy)
    )).scalar() or 0) + 1
    prefix = party_code(party)
    while True:
        candidate = f"{prefix}/{seq}"
        if not await invoice_no_taken(candidate, db):
            return candidate
        seq += 1


def company_dict_for_pdf(party: dict) -> dict:
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


def generate_pdf_bytes(
    party: dict,
    cfg: InvoiceConfig,
    particulars: list[dict],
    invoice_no: str,
    invoice_date: date,
) -> bytes:
    units = party.get("isin_units", 1)
    line_items = []
    for p in particulars:
        d = dict(p)
        if not d.get("non_taxable"):
            d["amount"] = float(d.get("amount") or 0) * units
        line_items.append(d)
    config = {
        "line_items": line_items,
        "gst_type": cfg.gst_type,
        "igst_rate": cfg.igst_rate,
        "cgst_rate": cfg.cgst_rate,
        "sgst_rate": cfg.sgst_rate,
        "bank_accounts": getattr(cfg, "bank_accounts", None) or [],
    }
    return generate_invoice_pdf(
        company_dict_for_pdf(party), config, invoice_no, invoice_date
    )


async def get_config(db: AsyncSession) -> InvoiceConfig:
    cfg = (await db.execute(select(InvoiceConfig).where(InvoiceConfig.id == 1))).scalar_one_or_none()
    if not cfg:
        cfg = InvoiceConfig(id=1, line_items=DEFAULT_LINE_ITEMS)
        db.add(cfg)
        await db.commit()
        await db.refresh(cfg)
    return cfg
