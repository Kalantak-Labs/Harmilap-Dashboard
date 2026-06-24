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


def isin_units(rows) -> int:
    units = 0
    for r in rows:
        if not r.isin_code:
            continue
        units += 2 if (r.has_nsdl_shares and r.has_cdsl_shares) else 1
    return units or 1


def party_key(c: Company) -> str | None:
    return c.nsdl_rta_code or c.cdsl_rta_code or None


async def list_parties_page(
    db: AsyncSession,
    search: str | None = None,
    skip: int = 0,
    limit: int = 50,
) -> tuple[list[dict], int]:
    """Paginated party list using SQL grouping — avoids loading all companies."""
    party_key_expr = sql_func.coalesce(Company.nsdl_rta_code, Company.cdsl_rta_code)
    base_where = or_(Company.nsdl_rta_code.isnot(None), Company.cdsl_rta_code.isnot(None))
    filters = [base_where]
    if search:
        s = search.strip()
        if s:
            filters.append(
                or_(
                    Company.company_name.ilike(f"%{s}%"),
                    Company.nsdl_rta_code.ilike(f"%{s}%"),
                    Company.cdsl_rta_code.ilike(f"%{s}%"),
                )
            )

    total = int((await db.execute(
        select(sql_func.count(sql_func.distinct(party_key_expr))).where(*filters)
    )).scalar() or 0)

    page_rows = (await db.execute(
        select(
            party_key_expr.label("party_key"),
            sql_func.max(Company.company_name).label("company_name"),
            sql_func.max(Company.nsdl_rta_code).label("nsdl_rta_code"),
            sql_func.max(Company.cdsl_rta_code).label("cdsl_rta_code"),
        )
        .where(*filters)
        .group_by(party_key_expr)
        .order_by(sql_func.lower(sql_func.max(Company.company_name)).nulls_last(), party_key_expr)
        .offset(skip)
        .limit(limit)
    )).all()

    if not page_rows:
        return [], total

    keys = [row.party_key for row in page_rows]
    company_rows = (await db.execute(
        select(
            Company.nsdl_rta_code,
            Company.cdsl_rta_code,
            Company.isin_code,
            Company.has_nsdl_shares,
            Company.has_cdsl_shares,
        ).where(
            base_where,
            or_(Company.nsdl_rta_code.in_(keys), Company.cdsl_rta_code.in_(keys)),
        )
    )).all()

    units_by_key: dict[str, list] = {}
    for row in company_rows:
        key = row.nsdl_rta_code or row.cdsl_rta_code
        if key and key in keys:
            units_by_key.setdefault(key, []).append(row)

    parties: list[dict] = []
    for row in page_rows:
        rows = units_by_key.get(row.party_key, [])
        parties.append({
            "party_key": row.party_key,
            "nsdl_rta_code": row.nsdl_rta_code,
            "cdsl_rta_code": row.cdsl_rta_code,
            "company_name": row.company_name,
            "isin_units": isin_units(rows) if rows else 1,
        })
    return parties, total


def _match_party_keys(
    row_nsdl: str | None,
    row_cdsl: str | None,
    parties: dict[str, dict],
    nsdl_to_keys: dict[str, list[str]],
    cdsl_to_keys: dict[str, list[str]],
) -> set[str]:
    """Match billing rows to parties using the same OR logic as billing_invoice_conds."""
    matched: set[str] = set()
    if row_nsdl and row_nsdl in nsdl_to_keys:
        for pk in nsdl_to_keys[row_nsdl]:
            if parties[pk].get("nsdl_rta_code") == row_nsdl:
                matched.add(pk)
    if row_cdsl and row_cdsl in cdsl_to_keys:
        for pk in cdsl_to_keys[row_cdsl]:
            if parties[pk].get("cdsl_rta_code") == row_cdsl:
                matched.add(pk)
    return matched


async def bulk_party_billing_stats(
    parties: dict[str, dict],
    db: AsyncSession,
) -> dict[str, dict]:
    """Aggregate billed/received/outstanding for all parties in two DB queries."""
    stats: dict[str, dict] = {
        key: {"total_billed": 0.0, "total_received": 0.0, "outstanding": 0.0, "invoice_count": 0}
        for key in parties
    }
    if not parties:
        return stats

    nsdl_to_keys: dict[str, list[str]] = {}
    cdsl_to_keys: dict[str, list[str]] = {}
    for key, party in parties.items():
        if party.get("nsdl_rta_code"):
            nsdl_to_keys.setdefault(party["nsdl_rta_code"], []).append(key)
        if party.get("cdsl_rta_code"):
            cdsl_to_keys.setdefault(party["cdsl_rta_code"], []).append(key)

    inv_rows = (await db.execute(
        select(BillingInvoice.nsdl_rta_code, BillingInvoice.cdsl_rta_code, BillingInvoice.grand_total)
    )).all()
    for inv_nsdl, inv_cdsl, total in inv_rows:
        matched = _match_party_keys(inv_nsdl, inv_cdsl, parties, nsdl_to_keys, cdsl_to_keys)
        amount = float(total or 0)
        for pk in matched:
            stats[pk]["total_billed"] += amount
            stats[pk]["invoice_count"] += 1

    pay_rows = (await db.execute(
        select(BillingPayment.nsdl_rta_code, BillingPayment.cdsl_rta_code, BillingPayment.amount)
    )).all()
    for pay_nsdl, pay_cdsl, amount in pay_rows:
        matched = _match_party_keys(pay_nsdl, pay_cdsl, parties, nsdl_to_keys, cdsl_to_keys)
        amt = float(amount or 0)
        for pk in matched:
            stats[pk]["total_received"] += amt

    for pk in stats:
        stats[pk]["total_billed"] = round(stats[pk]["total_billed"], 2)
        stats[pk]["total_received"] = round(stats[pk]["total_received"], 2)
        stats[pk]["outstanding"] = round(stats[pk]["total_billed"] - stats[pk]["total_received"], 2)

    return stats


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


def invoice_matches_party(inv: BillingInvoice, party: dict) -> bool:
    if party.get("nsdl_rta_code") and inv.nsdl_rta_code == party["nsdl_rta_code"]:
        return True
    if party.get("cdsl_rta_code") and inv.cdsl_rta_code == party["cdsl_rta_code"]:
        return True
    return False


async def validate_invoice_deletion(party: dict, inv: BillingInvoice, db: AsyncSession) -> None:
    """Block delete when payments received would exceed remaining billed total."""
    fin = await party_financials(party, db)
    new_billed = round(fin["total_billed"] - inv.grand_total, 2)
    if new_billed + 0.01 < fin["total_received"]:
        raise ValueError(
            f"Cannot delete: payments received ({fin['total_received']}) would exceed "
            f"remaining billed ({new_billed})"
        )


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


def effective_billed(party: dict, billed: int | None) -> int:
    """ISINs to bill: explicit value when given (>0), else all active ISIN units."""
    total = party.get("isin_units", 1)
    if billed is not None and billed > 0:
        return billed
    return total


def build_year_line_items(particulars: list[dict], year_isins: list[dict]) -> list[dict]:
    """Expand taxable particulars into one line per (financial year, ISIN count);
    non-taxable particulars are added once. Amounts are pre-scaled by each year's count."""
    taxable = [p for p in particulars if p.get("enabled", True) and not p.get("non_taxable")]
    nontax = [p for p in particulars if p.get("enabled", True) and p.get("non_taxable")]
    lines: list[dict] = []
    nid = 1
    for entry in year_isins or []:
        yr = str(entry.get("fiscal_year") or "").strip()
        cnt = int(entry.get("isin_count") or 0)
        if cnt <= 0 or not yr:
            continue
        for p in taxable:
            base = (p.get("description") or "")
            had_fy = "{fy}" in base or "{prev_fy}" in base or "{prev2_fy}" in base
            base = base.replace("{fy}", yr).replace("{prev_fy}", yr).replace("{prev2_fy}", yr)
            suffix = f" ({cnt} Active ISIN{'s' if cnt != 1 else ''})" if had_fy \
                else f" — FY {yr} ({cnt} Active ISIN{'s' if cnt != 1 else ''})"
            lines.append({
                "id": nid,
                "description": f"{base}{suffix}",
                "sac_code": p.get("sac_code", "997159"),
                "amount": float(p.get("amount") or 0) * cnt,
                "is_red": p.get("is_red", False),
                "non_taxable": False,
                "enabled": True,
            })
            nid += 1
    for p in nontax:
        d = dict(p)
        d["id"] = nid
        nid += 1
        lines.append(d)
    return lines


def company_dict_for_pdf(party: dict, billed: int | None = None,
                         year_breakdown: list | None = None) -> dict:
    total = party.get("isin_units", 1)
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
        "isin_total": total,
        "isin_billed": effective_billed(party, billed),
        "year_breakdown": year_breakdown or None,
    }


def generate_pdf_bytes(
    party: dict,
    cfg: InvoiceConfig,
    particulars: list[dict],
    invoice_no: str,
    invoice_date: date,
    billed: int | None = None,
    pre_scaled: bool = False,
    year_breakdown: list | None = None,
) -> bytes:
    scale = 1 if pre_scaled else effective_billed(party, billed)
    line_items = []
    for p in particulars:
        d = dict(p)
        if not pre_scaled and not d.get("non_taxable"):
            d["amount"] = float(d.get("amount") or 0) * scale
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
        company_dict_for_pdf(party, billed, year_breakdown), config, invoice_no, invoice_date
    )


async def get_config(db: AsyncSession) -> InvoiceConfig:
    cfg = (await db.execute(select(InvoiceConfig).where(InvoiceConfig.id == 1))).scalar_one_or_none()
    if not cfg:
        cfg = InvoiceConfig(id=1, line_items=DEFAULT_LINE_ITEMS)
        db.add(cfg)
        await db.commit()
        await db.refresh(cfg)
    return cfg
