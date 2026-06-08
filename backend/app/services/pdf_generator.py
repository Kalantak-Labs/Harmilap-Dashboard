"""
PDF generation for Harmilap RTA reports.
  1. Beneficiary Position (BENPOS)
  2. Share Capital Reconciliation Report
  3. Tax Invoice
"""

import io
import os
import zipfile
from datetime import date
from typing import Optional

from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    Image,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

# ── Colors ────────────────────────────────────────────────────────────────────
RED       = HexColor("#C00000")
GRAY_MID  = HexColor("#BFBFBF")
GRAY_LITE = HexColor("#D9D9D9")
PEACH     = HexColor("#FCE4D6")
DARK      = HexColor("#404040")
WHITE     = HexColor("#FFFFFF")
BLACK     = HexColor("#000000")
GRID_CLR  = HexColor("#AAAAAA")

# ── Page geometry ─────────────────────────────────────────────────────────────
PAGE_W, PAGE_H = A4            # 595.27 × 841.89 pts
MARGIN = 0.5 * inch            # 36 pts
CW = PAGE_W - 2 * MARGIN       # content width ≈ 523 pts

# ── Asset paths ───────────────────────────────────────────────────────────────
_ASSETS       = os.path.join(os.path.dirname(__file__), "..", "assets")
A_REPORT_HDR  = os.path.join(_ASSETS, "report_header.png")   # large white letterhead (used for both BENPOS and report)
A_INVOICE_HDR = os.path.join(_ASSETS, "invoice_header.png")  # large + PAN/GST line
A_ID_STRIP    = os.path.join(_ASSETS, "id_strip.png")         # SEBI/NSDL/CDSL strip
A_FOOTER      = os.path.join(_ASSETS, "footer_strip.png")     # Regd. address strip
A_STAMP       = os.path.join(_ASSETS, "stamp.png")            # round red seal (72×53 px)
A_QR          = os.path.join(_ASSETS, "qr_code.png")          # Paytm UPI QR

# Heights at full content width (scale proportionally from source pixel dims)
_RH  = CW * 376 / 2492   # report/benpos header ≈ 79 pts
_INH = CW * 403 / 2565   # invoice header        ≈ 82 pts
_FH  = CW * 35  / 1000   # footer strip          ≈ 18.3 pts

_BOTTOM = MARGIN + _FH + 5   # frame bottom y-coordinate


# ── Ordinal date helper ───────────────────────────────────────────────────────
def _ordinal(n: int) -> str:
    if 11 <= n <= 13:
        return f"{n}th"
    return f"{n}" + {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")


def _date_long(d: date) -> str:
    return f"{_ordinal(d.day)} {d.strftime('%B %Y')}"


# ── Style factory ─────────────────────────────────────────────────────────────
def _s(
    name: str = "n",
    font: str = "Helvetica",
    size: float = 10,
    leading: float = 14,
    color=BLACK,
    align=TA_LEFT,
    **kw,
) -> ParagraphStyle:
    return ParagraphStyle(
        name, fontName=font, fontSize=size, leading=leading,
        textColor=color, alignment=align,
        spaceBefore=0, spaceAfter=0, **kw,
    )


def P(text: str, style: ParagraphStyle) -> Paragraph:
    return Paragraph(text, style)


def SP(pts: float = 6) -> Spacer:
    return Spacer(1, pts)


# ── FY helpers ────────────────────────────────────────────────────────────────
def current_fy(d: date | None = None) -> str:
    d = d or date.today()
    if d.month >= 4:
        return f"{d.year}-{str(d.year + 1)[2:]}"
    return f"{d.year - 1}-{str(d.year)[2:]}"


def prev_fy(fy: str, n: int = 1) -> str:
    y = int(fy[:4]) - n
    return f"{y}-{str(y + 1)[2:]}"


# ── Core PDF builder ──────────────────────────────────────────────────────────
def _build(
    story: list,
    hdr_path: str,
    hdr_h: float,
) -> bytes:
    """Wrap story in a document with header/footer painted by canvas callback."""
    buf = io.BytesIO()
    top = MARGIN + hdr_h + 5

    def _draw(canvas, _doc):
        canvas.saveState()
        y = PAGE_H - MARGIN - hdr_h
        canvas.drawImage(hdr_path, MARGIN, y, width=CW, height=hdr_h,
                         preserveAspectRatio=False, mask="auto")
        canvas.drawImage(A_FOOTER, MARGIN, MARGIN, width=CW, height=_FH,
                         preserveAspectRatio=False, mask="auto")
        canvas.restoreState()

    frame = Frame(
        MARGIN, _BOTTOM, CW, PAGE_H - top - _BOTTOM,
        leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0,
    )
    tpl = PageTemplate(id="main", frames=[frame], onPage=_draw)
    doc = BaseDocTemplate(buf, pagesize=A4, pageTemplates=[tpl])
    doc.build(story)
    return buf.getvalue()


# ── Table style helper ────────────────────────────────────────────────────────
def _ts(*extra) -> TableStyle:
    return TableStyle([
        ("FONT",          (0, 0), (-1, -1), "Helvetica", 10),
        ("GRID",          (0, 0), (-1, -1), 0.4, GRID_CLR),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING",   (0, 0), (-1, -1), 4),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 4),
        ("TOPPADDING",    (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        *extra,
    ])


def _no_border_ts() -> TableStyle:
    return TableStyle([
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING",   (0, 0), (-1, -1), 0),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
        ("TOPPADDING",    (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ])


# ── Address helper ────────────────────────────────────────────────────────────
def _addr(company: dict, sep: str = ", ") -> str:
    """Return billing_address if set, else join reg_address fields."""
    ba = company.get("billing_address")
    if ba:
        return ba
    return sep.join(filter(None, [
        company.get("reg_address_line1"),
        company.get("reg_address_line2"),
        company.get("reg_address_line3"),
        company.get("reg_address_line4"),
        company.get("reg_city"),
        company.get("reg_pin_code"),
    ]))


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 1. BENPOS — Beneficiary Position
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
def generate_benpos_pdf(
    company: dict,
    beneficiaries: list[dict],
    record_date: Optional[date],
) -> bytes:
    s_bold  = _s("bb", "Helvetica-Bold", 11, 15)
    s_body  = _s("b",  size=11, leading=15)
    s_red_c = _s("rc", "Helvetica-Bold", 11, 15, color=RED, align=TA_CENTER)
    s_hdr   = _s("th", "Helvetica-Bold", 10, 13)
    s_cell  = _s("tc", size=10, leading=13)
    s_right = _s("tr", size=10, leading=13, align=TA_RIGHT)
    s_tot_l = _s("ttl", "Helvetica-Bold", 10, 13)
    s_tot_r = _s("ttr", "Helvetica-Bold", 10, 13, align=TA_RIGHT)
    s_red_b = _s("rb", "Helvetica-Bold", 11, 15, color=RED)

    story = []

    # Company header info — prefer billing_address
    addr = _addr(company)

    info = Table(
        [
            [P("Company / Firm Name", s_bold), P(":", s_bold),
             P(company.get("company_name") or "", s_bold)],
            [P("Regd. / Billing Address", s_bold), P(":", s_bold),
             P(addr, s_bold)],
        ],
        colWidths=[CW * 0.36, 12, CW * 0.62],
    )
    info.setStyle(_no_border_ts())
    story.append(info)
    story.append(SP(8))

    rd_str       = record_date.strftime("%d.%m.%Y") if record_date else "N/A"
    isin         = company.get("isin_code", "")
    security_type = (company.get("security_type") or "EQUITY").upper()
    story.append(P(f"BENPOS AS ON {rd_str} FOR {security_type} ISIN: {isin}", s_red_c))
    story.append(SP(10))

    # Beneficiary table
    col_w = [CW * w for w in (0.06, 0.12, 0.12, 0.30, 0.14, 0.13, 0.13)]
    headers = [
        "S. No.", "DP ID", "Client ID",
        "Name of Shareholder", "PAN Card No",
        "Free Securities", "Pledge Securities\n(if any)",
    ]
    rows = [[P(h, s_hdr) for h in headers]]

    total_free = total_pledge = 0
    for i, b in enumerate(beneficiaries, 1):
        free   = b.get("free_positions") or 0
        pledge = b.get("pledged_positions") or 0
        total_free   += free
        total_pledge += pledge
        rows.append([
            P(str(i),                              s_right),
            P(b.get("dp_id") or "",               s_cell),
            P(b.get("client_id") or "",           s_right),
            P(b.get("first_holder_name") or "",   s_cell),
            P(b.get("first_holder_pan") or "",    s_cell),
            P(f"{free:,}",                        s_right),
            P(f"{pledge:,}",                      s_right),
        ])

    # Total row
    rows.append([
        P("", s_cell), P("", s_cell), P("", s_cell),
        P("Total Securities", s_tot_l),
        P("", s_cell),
        P(f"{total_free:,}",   s_tot_r),
        P(f"{total_pledge:,}", s_tot_r),
    ])

    n = len(rows)
    tbl = Table(rows, colWidths=col_w, repeatRows=1)
    tbl.setStyle(_ts(
        ("BACKGROUND", (0, 0),  (-1, 0),      GRAY_MID),
        ("BACKGROUND", (0, 1),  (-1, n - 1),  PEACH),
        ("ALIGN",      (0, 0),  (-1, 0),      "CENTER"),
        ("ALIGN",      (0, 1),  (0, -1),      "RIGHT"),
        ("ALIGN",      (2, 1),  (2, -1),      "RIGHT"),
        ("ALIGN",      (5, 1),  (6, -1),      "RIGHT"),
        ("FONT",       (0, 0),  (-1, 0),      "Helvetica-Bold", 10),
        ("FONT",       (3, -1), (3, -1),      "Helvetica-Bold", 10),
        ("FONT",       (5, -1), (6, -1),      "Helvetica-Bold", 10),
    ))
    story.append(tbl)
    story.append(SP(12))

    # Footer text — exactly as in template
    story.append(P(
        "In case of any discrepancy in the above report, kindly contact us immediately "
        "at Ph: 9205234407 or via email at harmilaprta@gmail.com.",
        s_body,
    ))
    story.append(SP(6))
    story.append(P(
        "<b>Note:</b><br/>"
        "&#8226; This report has been generated as per the request of the Issuer Client "
        "Company. In case of any queries, please feel free to contact us.<br/>&#8226;",
        s_body,
    ))
    story.append(SP(14))
    story.append(P("Thanking you,", s_body))
    story.append(SP(4))
    story.append(P("Back Office", s_bold))
    story.append(P("Harmilap Share Transfer Agents", s_red_b))
    story.append(P("Ph: 9205234407 / 8929835991", s_bold))

    # Use the same large white letterhead as the Reconciliation Report
    return _build(story, A_REPORT_HDR, _RH)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 2. Share Capital Reconciliation Report
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
def generate_report_pdf(
    company: dict,
    record_date: Optional[date],
    ref_prefix: Optional[str] = None,
    gen_date: Optional[date] = None,
) -> bytes:
    """
    record_date : the "as on" date shown in the report title (customizable)
    ref_prefix  : the part of the reference number before "/RTAN{rta_code}"
                  e.g. "2026-27/NSDL/MAR26". Auto-generated if None.
    gen_date    : the "Date:" field (report generation date). Defaults to today.
    """
    isin     = company.get("isin_code", "")
    name     = company.get("company_name") or isin
    sec_type = (company.get("security_type") or "EQUITY").upper()
    today    = gen_date or date.today()
    rd       = record_date or today
    rd_long  = _date_long(rd)
    fy       = current_fy(rd)
    rta      = company.get("rta_code") or ""

    if ref_prefix:
        ref_no = f"{ref_prefix}/RTAN{rta}"
    else:
        ref_no = f"{fy}/NSDL/{rd.strftime('%b%y').upper()}/RTAN{rta}"

    gen_date_str = today.strftime("%d.%m.%Y")

    s_body  = _s("b",  size=10, leading=14)
    s_bold  = _s("bb", "Helvetica-Bold", 10, 14)
    s_just  = _s("j",  size=10, leading=14, align=TA_JUSTIFY)
    s_hdr   = _s("th", "Helvetica-Bold", 10, 13)
    s_num_b = _s("nb", "Helvetica-Bold", 10, 13, align=TA_RIGHT)
    s_wh_c  = _s("wc", "Helvetica-Bold", 11, 15, color=WHITE, align=TA_CENTER)
    s_red_c = _s("rdc","Helvetica-Bold", 10, 14, color=RED)
    s_stmp  = _s("st", size=10, leading=14)

    story = []

    # Red title bar
    title = Table(
        [[P(f"Report on Share Capital Reconciliation Report as on {rd_long}", s_wh_c)]],
        colWidths=[CW],
    )
    title.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), RED),
        ("TOPPADDING",    (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING",   (0, 0), (-1, -1), 4),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 4),
    ]))
    story.append(title)
    story.append(SP(8))

    # Reference No and Date — Date is the report generation date (today)
    ref = Table(
        [[P(f"<b>Reference No:</b> {ref_no}", s_body),
          P(f"<b>Date:</b> <b>{gen_date_str}</b>",
            _s("dr", "Helvetica-Bold", 10, 14, align=TA_RIGHT))]],
        colWidths=[CW * 0.65, CW * 0.35],
    )
    ref.setStyle(_no_border_ts())
    story.append(ref)
    story.append(SP(10))

    story.append(P("To,", s_body))
    story.append(P(f"<b>{name}</b>", s_body))
    story.append(SP(8))
    story.append(P("Dear Sir / Madam,", s_body))
    story.append(SP(6))
    story.append(P(
        f"The following are the reconciliation details for "
        f"<b><font color='#C00000'>{sec_type}</font></b> <b>paid-up share capital</b> of "
        f"<b><font color='#C00000'>{name}</font></b> "
        f"(<b>ISIN: <font color='#C00000'>{isin}</font></b>) as on <b>{rd_long}</b>.",
        s_body,
    ))
    story.append(SP(6))
    story.append(P(
        "We hereby confirm that the <b>Register of Members is being maintained in "
        "electronic form only &amp; the same is updated as on the above-mentioned date.</b>",
        s_body,
    ))
    story.append(SP(10))

    # Share capital table
    nsdl  = company.get("nsdl_shares")  or 0
    cdsl  = company.get("cdsl_shares")  or 0
    phys  = company.get("physical_shares") or 0
    total = company.get("total_shares") or (nsdl + cdsl + phys)

    def pct(n: int) -> str:
        return f"{n / total * 100:.2f}" if total else "0.00"

    share_tbl = Table(
        [
            [P("Category", s_hdr), P("No. of Shares", s_hdr), P("Percentage (%)", s_hdr)],
            [P("Shares in Demat Mode with NSDL", s_body), P(f"{nsdl:,}", s_num_b), P(pct(nsdl), s_num_b)],
            [P("Shares in Demat Mode with CDSL", s_body), P(f"{cdsl:,}", s_num_b), P(pct(cdsl), s_num_b)],
            [P("Shares in Physical Mode",        s_body), P(f"{phys:,}", s_num_b), P(pct(phys), s_num_b)],
            [P("<b>Total</b>", s_bold), P(f"<b>{total:,}</b>", s_num_b), P("<b>100.00</b>", s_num_b)],
        ],
        colWidths=[CW * 0.55, CW * 0.25, CW * 0.20],
    )
    share_tbl.setStyle(_ts(
        ("BACKGROUND", (0, 0), (-1, 0), GRAY_LITE),
        ("FONT",       (0, 0), (-1, 0), "Helvetica-Bold", 10),
        ("ALIGN",      (1, 0), (2, -1), "RIGHT"),
    ))
    story.append(share_tbl)
    story.append(SP(12))

    # Dematerialisation Requests
    story.append(P("<b><font color='#C00000'>Dematerialisation Requests</font></b>", s_body))
    story.append(SP(4))
    story.append(P(
        "Details of demat requests, if any, confirmed after 21 days and requests "
        "pending beyond 21 days are as under:", s_body))
    story.append(SP(6))

    demat = Table(
        [
            [P("Total No. of Demat Requests", s_hdr), P("No. of Requests", s_hdr),
             P("No. of Shares", s_hdr), P("Reason for Delay", s_hdr)],
            [P("Confirmed after 21 days",   s_body), P("Zero", s_body),
             P("Zero", s_body), P("Not Applicable", s_body)],
            [P("Pending more than 21 days", s_body), P("Zero", s_body),
             P("Zero", s_body), P("Not Applicable", s_body)],
        ],
        colWidths=[CW * 0.35, CW * 0.18, CW * 0.18, CW * 0.29],
    )
    demat.setStyle(_ts(("FONT", (0, 0), (-1, 0), "Helvetica-Bold", 10)))
    story.append(demat)
    story.append(SP(12))

    # Important Notes — no bullets, separate paragraphs, exact wording
    story.append(P("<b><font color='#C00000'>Important Notes: -</font></b>", s_body))
    story.append(SP(4))

    story.append(P(
        "This report is prepared based on the Beneficiary reports shared by the Depository "
        "and helps the company to update records with other authorities. However, the company "
        "must consider the physical holding / further issuance of securities (if any) and match "
        "the same with internal company records when filing details with any authority.",
        s_just,
    ))
    story.append(SP(4))
    story.append(P(
        "Beneficiary Position is attached with report only in case of Demat / Electronic Holdings",
        s_body,
    ))
    story.append(SP(4))
    story.append(P(
        "This report should be checked and verified by the Company Secretary before filing with any authority.",
        s_just,
    ))
    story.append(SP(4))
    story.append(P(
        "\"<b>Harmilap Share Transfer Agents</b>\" shall not be held responsible, directly or indirectly, "
        "for any false, misleading, or misrepresented information submitted by the company to any authority "
        "without verifying the same with the company&#8217;s internal records.",
        s_just,
    ))
    story.append(SP(10))

    story.append(P(
        "In case of any discrepancy in the above report, kindly contact us immediately at "
        "Ph: 9205234407 or email harmilaprta@gmail.com",
        s_body,
    ))
    story.append(SP(14))
    story.append(P("Thanking You", s_body))
    story.append(SP(4))
    story.append(P("For <b>HARMILAP SHARE TRANSFER AGENTS</b>", s_body))
    story.append(SP(30))

    # Stamp + Authorised Signatory
    stamp_w = 0.75 * inch
    stamp_h = stamp_w * 53 / 72
    stamp_tbl = Table(
        [[Image(A_STAMP, width=stamp_w, height=stamp_h), P("", s_body)]],
        colWidths=[stamp_w + 6, CW - stamp_w - 6],
    )
    stamp_tbl.setStyle(TableStyle([
        ("VALIGN",        (0, 0), (-1, -1), "BOTTOM"),
        ("LEFTPADDING",   (0, 0), (-1, -1), 0),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
        ("TOPPADDING",    (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(stamp_tbl)
    story.append(P("<b>Authorised Signatory</b>", s_body))

    return _build(story, A_REPORT_HDR, _RH)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 3. Tax Invoice
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
def generate_invoice_pdf(
    company: dict,
    config: dict,
    invoice_no: str,
    invoice_date: date,
) -> bytes:
    fy    = current_fy(invoice_date)
    p_fy  = prev_fy(fy, 1)
    p2_fy = prev_fy(fy, 2)

    items     = config.get("line_items", [])
    gst_type  = config.get("gst_type", "IGST")
    igst_rate = float(config.get("igst_rate", 18.0))
    cgst_rate = float(config.get("cgst_rate", 9.0))
    sgst_rate = float(config.get("sgst_rate", 9.0))

    name  = company.get("company_name") or ""
    addr  = _addr(company)
    gst   = company.get("gst_number") or company.get("pan_number") or "N/A"
    supply_parts = list(filter(None, [company.get("reg_city"), company.get("reg_pin_code")]))
    place = ",".join(supply_parts) if supply_parts else "N/A"

    s_body = _s("b",  size=10, leading=13)
    s_bold = _s("bb", "Helvetica-Bold", 10, 13)
    s_c    = _s("c",  size=10, leading=13, align=TA_CENTER)
    s_r    = _s("r",  size=10, leading=13, align=TA_RIGHT)
    s_rb   = _s("rb", "Helvetica-Bold", 10, 13, align=TA_RIGHT)
    s_cb   = _s("cb", "Helvetica-Bold", 10, 13, align=TA_CENTER)
    s_red  = _s("rd", "Helvetica-Bold", 10, 13, color=RED)
    s_sm   = _s("sm", size=8, leading=10)
    s_smb  = _s("smb","Helvetica-Bold", 8, 10)
    s_smj  = _s("smj", size=8, leading=10, align=TA_JUSTIFY)
    s_sm_r = _s("smr","Helvetica-Bold", 10, 14, color=RED)
    s_wh   = _s("wh", "Helvetica-Bold", 9, 12, color=WHITE, align=TA_CENTER)
    s_wh_t = _s("wt", "Helvetica-Bold", 13, 17, color=WHITE, align=TA_CENTER)
    s_wh_s = _s("ws", "Helvetica-Bold", 10, 13, color=WHITE, align=TA_CENTER)
    s_sm_c = _s("smc", size=9, leading=12, align=TA_CENTER)

    story = []

    # ── Red invoice header ────────────────────────────────────────────────────
    hdr = Table(
        [
            [P("<b>TAX &#8211; INVOICE</b>", s_wh_t)],
            [P(
                f"<b>Invoice No: {invoice_no} (FY{fy})</b>"
                f"&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"
                f"<b>Date: {invoice_date.strftime('%d.%m.%Y')}</b>",
                s_wh_s,
            )],
        ],
        colWidths=[CW],
    )
    hdr.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), RED),
        ("TOPPADDING",    (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING",   (0, 0), (-1, -1), 4),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 4),
    ]))
    story.append(hdr)
    story.append(SP(6))

    # ── Billing address ───────────────────────────────────────────────────────
    bill = Table(
        [
            [P("<b>Billing (Bill To) &amp; Delivery Address (Ship To):</b>", s_body), P("", s_body)],
            [P(f"<b>Company / Firm Name &nbsp;&nbsp;&nbsp; {name}</b>", s_body), P("", s_body)],
            [P(f"<b>Regd. / Billing Address &nbsp;&nbsp; {addr}</b>", s_body), P("", s_body)],
            [P(f"<b>PAN / GST No:</b> {gst}", s_body),
             P(f"<b>PLACE OF SUPPLY:</b> {place}", s_body)],
        ],
        colWidths=[CW * 0.6, CW * 0.4],
    )
    bill.setStyle(TableStyle([
        ("BOX",           (0, 0), (-1, -1), 0.5, GRID_CLR),
        ("INNERGRID",     (0, 0), (-1, -1), 0.3, HexColor("#DDDDDD")),
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING",    (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING",   (0, 0), (-1, -1), 5),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 5),
        ("SPAN",          (0, 0), (1, 0)),
        ("SPAN",          (0, 1), (1, 1)),
        ("SPAN",          (0, 2), (1, 2)),
    ]))
    story.append(bill)
    story.append(SP(6))

    # ── Service items table ───────────────────────────────────────────────────
    svc_rows = [
        [P("S. No.", s_cb), P("Description of Services", s_cb),
         P("SAC Code", s_cb), P("Amount (Rs.)", s_cb)],
    ]

    enabled = [it for it in items if it.get("enabled", True)]
    taxable_total = non_taxable_total = 0

    for idx, it in enumerate(enabled, 1):
        desc   = (it.get("description") or "").replace("{fy}", fy).replace("{prev_fy}", p_fy).replace("{prev2_fy}", p2_fy)
        sac    = str(it.get("sac_code") or "")
        amt    = float(it.get("amount") or 0)
        is_nt  = it.get("non_taxable", False)
        is_red = it.get("is_red", False)
        if is_nt:
            non_taxable_total += amt
        else:
            taxable_total += amt
        svc_rows.append([
            P(str(idx), s_c),
            P(desc, s_red if is_red else s_body),
            P(sac, s_c),
            P(f"{int(amt):,}" if amt else "0", s_r),
        ])

    n_items = len(enabled)
    sub_r = n_items + 1  # 0-based index of first subtotal row

    def sub_row(label: str, val: float, bold: bool = False):
        ls = _s("sl", "Helvetica-Bold" if bold else "Helvetica", 10, 13, align=TA_RIGHT)
        vs = _s("sv", "Helvetica-Bold" if bold else "Helvetica", 10, 13, align=TA_RIGHT)
        return [P("", s_body), P("", s_body), P(label, ls), P(f"{int(val):,}" if val else "0", vs)]

    svc_rows.append(sub_row("Non-Taxable Value (Actual Expenses / Out-of-Pocket)", non_taxable_total))
    svc_rows.append(sub_row("Total Taxable Value (GST charged)", taxable_total, bold=True))

    gst_amt = 0.0
    if gst_type == "IGST":
        igst = round(taxable_total * igst_rate / 100)
        gst_amt = igst
        svc_rows.append(sub_row("CGST (9%)", 0))
        svc_rows.append(sub_row("SGST (9%)", 0))
        svc_rows.append(sub_row(f"IGST ({igst_rate:.0f}%)", igst))
        svc_rows.append(sub_row("UTSGT (18%)", 0))   # matches template spelling
    else:
        cgst = round(taxable_total * cgst_rate / 100)
        sgst = round(taxable_total * sgst_rate / 100)
        gst_amt = cgst + sgst
        svc_rows.append(sub_row(f"CGST ({cgst_rate:.0f}%)", cgst))
        svc_rows.append(sub_row(f"SGST ({sgst_rate:.0f}%)", sgst))
        svc_rows.append(sub_row("IGST (18%)", 0))
        svc_rows.append(sub_row("UTSGT (18%)", 0))

    grand = taxable_total + gst_amt + non_taxable_total
    svc_rows.append(sub_row("Total Amount to be Paid (In Figures)", grand, bold=True))

    n_svc = len(svc_rows)
    spans = [("SPAN", (0, r), (1, r)) for r in range(sub_r, n_svc)]

    svc = Table(svc_rows, colWidths=[CW * 0.06, CW * 0.52, CW * 0.24, CW * 0.18], repeatRows=1)
    svc.setStyle(_ts(
        ("BACKGROUND", (0, 0),         (-1, 0),            GRAY_MID),
        ("FONT",       (0, 0),         (-1, 0),            "Helvetica-Bold", 10),
        ("ALIGN",      (0, 1),         (0, n_items),       "CENTER"),
        ("ALIGN",      (3, 1),         (3, -1),            "RIGHT"),
        ("ALIGN",      (2, sub_r),     (2, -1),            "RIGHT"),
        ("BACKGROUND", (0, sub_r),     (-1, sub_r),        GRAY_MID),
        ("BACKGROUND", (0, sub_r + 1), (-1, sub_r + 1),   GRAY_MID),
        ("FONT",       (2, -1),        (3, -1),            "Helvetica-Bold", 10),
        *spans,
    ))
    story.append(svc)
    story.append(SP(6))

    # ── Important notes (exact verbatim, 10 notes, no bullets) ───────────────
    notes_9 = [
        "This invoice is issued subject to the <b>Byelaws, Business Rules, and operational guidelines of Harmilap Share Transfer Agents</b>.",
        "The <b>due date for payment</b> of this Tax Invoice is <b>within 60 days from the date of issue</b>.",
        "The amount payable under this invoice should be remitted <b>only through NEFT / RTGS or by Account Payee Cheque / Demand Draft</b> in favour of <b>Harmilap Share Transfer Agents</b>.",
        "Interest at the rate of <b>18% per annum</b> will be charged on payments delayed beyond <b>60 days</b>, calculated on a <b>monthly basis</b> until the outstanding amount is cleared.",
        "In case any excess payment is made to the Depository or any Stamp Duty is paid to the Government on behalf of the <b>company</b>, the same shall be <b>recoverable from the company</b>.",
        "The <b>PAN number is mentioned on the invoice only in cases where the company does not have a valid GSTIN</b>.",
        "<b>Kindly verify the PAN and GST details mentioned in the invoice</b>. In case of any discrepancy, please inform us immediately for necessary correction before GST filing and <b>this TAX Invoice is considered in GST return only after making payment by the Issuer Client company</b>.",
        "<b>GST returns are filed on a quarterly basis</b>. Therefore, <b>no corrections or modifications will be possible once the GST return has been filed</b>.",
        "We are registered in MSME as Micro Enterprises and our <b>MSME Registration No: UDYAM-DL-04-0005989</b>",
    ]
    note_10 = (
        "If there are any dues or outstanding payments pending for more than 60 days, we will be "
        "compelled to stop all services, deactivate the ISIN, and report the matter to the depository."
    )

    story.append(P("<b><u>Important Notes:</u></b>", s_smb))
    story.append(SP(2))
    for note in notes_9:
        story.append(P(note, s_smj))
        story.append(SP(2))
    # Last note: 10pt bold red
    story.append(P(f"<font size='10'><b><font color='#C00000'>{note_10}</font></b></font>", s_sm))
    story.append(SP(8))

    # ── Bank / UPI ────────────────────────────────────────────────────────────
    story.append(P(
        "<b>You can transfer Funds by IMPS / NEFT in following Bank Accounts</b>",
        _s("bk", "Helvetica-Bold", 9, 12, align=TA_CENTER),
    ))
    story.append(SP(6))

    qr_w   = 1.3 * inch
    qr_h   = 1.3 * inch
    stmp_w = 0.7 * inch
    stmp_h = stmp_w * 53 / 72
    qr_row = Table(
        [[Image(A_QR, width=qr_w, height=qr_h),
          P("", s_body),
          Image(A_STAMP, width=stmp_w, height=stmp_h)]],
        colWidths=[CW * 0.25, CW * 0.5, CW * 0.25],
    )
    qr_row.setStyle(TableStyle([
        ("ALIGN",  (0, 0), (0, 0), "CENTER"),
        ("ALIGN",  (2, 0), (2, 0), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(qr_row)
    story.append(SP(6))

    # ── Dark footer bar ───────────────────────────────────────────────────────
    ftr = Table(
        [[P("Thanking You for Choosing us as your Registrar and Share Transfer Agents", s_wh)]],
        colWidths=[CW],
    )
    ftr.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), DARK),
        ("TOPPADDING",    (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(ftr)
    story.append(SP(4))

    # ── Contact line below dark bar ───────────────────────────────────────────
    story.append(P(
        "If there is any query, please feel free to Contact us at "
        "Ph: 9205234407 / 8929835991 or email us at harmilaprta@gmail.com",
        _s("ct", size=9, leading=12, align=TA_CENTER),
    ))

    return _build(story, A_INVOICE_HDR, _INH)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Bulk ZIP helper
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
def zip_pdfs(entries: list[tuple[str, bytes]]) -> bytes:
    """Pack a list of (filename, pdf_bytes) into a ZIP."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for filename, data in entries:
            zf.writestr(filename, data)
    return buf.getvalue()
