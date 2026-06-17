"""
PDF generation for Harmilap RTA reports.
  1. Beneficiary Position (BENPOS)
  2. Share Capital Reconciliation Report
  3. Tax Invoice
"""

import io
import os
import zipfile
from datetime import date, timedelta
from typing import Optional

from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.utils import ImageReader
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
BLUE      = HexColor("#1F4E79")
GRAY_MID  = HexColor("#BFBFBF")
GRAY_LITE = HexColor("#D9D9D9")
PEACH     = HexColor("#FCE4D6")
SKY_BLUE  = HexColor("#DAEEF3")
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
A_LOGO        = os.path.join(_ASSETS, "logo.png")             # standalone Harmilap crown logo

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
def _rta_prefix(company: dict) -> str:
    """Return 'NSDL/CDSL' combined RTA prefix for reference numbers."""
    parts = [v for v in [company.get("nsdl_rta_code"), company.get("cdsl_rta_code")] if v]
    return "/".join(parts)


GST_STATE = {
    "01": "Jammu and Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh",
    "05": "Uttarakhand", "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh",
    "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur",
    "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal",
    "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
    "26": "Dadra and Nagar Haveli and Daman and Diu", "27": "Maharashtra", "29": "Karnataka",
    "30": "Goa", "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry",
    "35": "Andaman and Nicobar Islands", "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh",
}


_ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
         "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen",
         "Eighteen", "Nineteen"]
_TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]


def _two_words(n: int) -> str:
    if n < 20:
        return _ONES[n]
    return _TENS[n // 10] + (" " + _ONES[n % 10] if n % 10 else "")


def _three_words(n: int) -> str:
    h, r = n // 100, n % 100
    s = (_ONES[h] + " Hundred") if h else ""
    if r:
        s += (" " if s else "") + _two_words(r)
    return s


def _amount_in_words(amount: float) -> str:
    """Indian-system amount in words, e.g. 'Rupees Four Thousand One Hundred Thirty Only'."""
    rupees = int(round(amount))
    if rupees == 0:
        return "Rupees Zero Only"
    parts: list[str] = []
    crore = rupees // 10_000_000; rupees %= 10_000_000
    lakh = rupees // 100_000; rupees %= 100_000
    thousand = rupees // 1_000; rupees %= 1_000
    if crore:
        parts.append(_two_words(crore) + " Crore")
    if lakh:
        parts.append(_two_words(lakh) + " Lakh")
    if thousand:
        parts.append(_two_words(thousand) + " Thousand")
    if rupees:
        parts.append(_three_words(rupees))
    return "Rupees " + " ".join(parts) + " Only"


def _place_of_supply(company: dict) -> str:
    """From GST state code (first 2 digits) → 'State / Code'; else city + pin code."""
    gst = (company.get("gst_number") or "").strip()
    if len(gst) >= 2 and gst[:2] in GST_STATE:
        return f"{GST_STATE[gst[:2]]} / {gst[:2]}"
    parts = list(filter(None, [company.get("reg_city"), company.get("reg_pin_code")]))
    return ", ".join(parts) if parts else "N/A"


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


# ── BENPOS helpers ────────────────────────────────────────────────────────────

def _watermark_data(hdr_path: str) -> Optional[tuple]:
    """Crop left logo from header, reduce opacity. Returns (png_bytes, w_px, h_px) or None."""
    try:
        from PIL import Image as PILImage
        img = PILImage.open(hdr_path).convert("RGBA")
        w, h = img.size
        crop_w = int(w * 0.22)
        logo = img.crop((0, 0, crop_w, h))
        r, g, b, a = logo.split()
        a = a.point(lambda v: int(v * 0.12))
        out = io.BytesIO()
        PILImage.merge("RGBA", (r, g, b, a)).save(out, "PNG")
        return (out.getvalue(), crop_w, h)
    except Exception:
        return None


_EXTRA_BOTTOM = 14   # pts reserved below footer strip for the contact line


def _build_full(story: list, hdr_path: str, hdr_h: float) -> bytes:
    """Build PDF with watermark, extended footer contact line, and custom header."""
    wm  = _watermark_data(hdr_path)
    buf = io.BytesIO()
    top    = MARGIN + hdr_h + 5
    bottom = _BOTTOM + _EXTRA_BOTTOM

    def _draw(canvas, _doc):
        canvas.saveState()
        canvas.drawImage(hdr_path, MARGIN, PAGE_H - MARGIN - hdr_h,
                         width=CW, height=hdr_h, preserveAspectRatio=False, mask="auto")
        canvas.drawImage(A_FOOTER, MARGIN, MARGIN + _EXTRA_BOTTOM,
                         width=CW, height=_FH, preserveAspectRatio=False, mask="auto")
        canvas.setFont("Helvetica", 7.5)
        canvas.setFillColor(RED)
        canvas.drawCentredString(
            PAGE_W / 2, MARGIN + 2,
            "Email Id: harmilaprta@gmail.com  |  "
            "Contact No: +91-8929835991 / 9310931755 / 9205234407",
        )
        if wm:
            wm_bytes, wm_w_px, wm_h_px = wm
            reader = ImageReader(io.BytesIO(wm_bytes))
            wm_w = 3.5 * inch
            wm_h = wm_w * (wm_h_px / wm_w_px)
            canvas.drawImage(reader,
                             (PAGE_W - wm_w) / 2, (PAGE_H - wm_h) / 2,
                             width=wm_w, height=wm_h, mask="auto")
        canvas.restoreState()

    frame = Frame(MARGIN, bottom, CW, PAGE_H - top - bottom,
                  leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    tpl = PageTemplate(id="main", frames=[frame], onPage=_draw)
    doc = BaseDocTemplate(buf, pagesize=A4, pageTemplates=[tpl])
    doc.build(story)
    return buf.getvalue()


def _invoice_logo(height: float = 46):
    """Standalone crown logo (logo.png) if present, else cropped from the letterhead."""
    try:
        from PIL import Image as PILImage
        if os.path.exists(A_LOGO):
            img = PILImage.open(A_LOGO).convert("RGBA")
        else:
            full = PILImage.open(A_INVOICE_HDR).convert("RGBA")
            w, h = full.size
            img = full.crop((0, 0, int(w * 0.20), h))
        out = io.BytesIO()
        img.save(out, "PNG")
        out.seek(0)
        w_px, h_px = img.size
        return Image(out, width=height * (w_px / h_px), height=height)
    except Exception:
        return Spacer(1, height)


def _invoice_watermark() -> Optional[tuple]:
    """Faint centre watermark from logo.png if present, else from the letterhead crop."""
    if os.path.exists(A_LOGO):
        try:
            from PIL import Image as PILImage
            img = PILImage.open(A_LOGO).convert("RGBA")
            r, g, b, a = img.split()
            a = a.point(lambda v: int(v * 0.10))
            out = io.BytesIO()
            PILImage.merge("RGBA", (r, g, b, a)).save(out, "PNG")
            return (out.getvalue(), img.size[0], img.size[1])
        except Exception:
            pass
    return _watermark_data(A_INVOICE_HDR)


def _build_invoice(story: list) -> bytes:
    """Invoice page: text header is part of the flow; only footer + watermark are painted."""
    wm  = _invoice_watermark()
    buf = io.BytesIO()
    top    = MARGIN + 4
    bottom = _BOTTOM + _EXTRA_BOTTOM

    def _draw(canvas, _doc):
        canvas.saveState()
        canvas.drawImage(A_FOOTER, MARGIN, MARGIN + _EXTRA_BOTTOM,
                         width=CW, height=_FH, preserveAspectRatio=False, mask="auto")
        canvas.setFont("Helvetica", 7.5)
        canvas.setFillColor(RED)
        canvas.drawCentredString(
            PAGE_W / 2, MARGIN + 2,
            "Email Id: harmilaprta@gmail.com  |  "
            "Contact No: +91-8929835991 / 9310931755 / 9205234407",
        )
        if wm:
            wm_bytes, wm_w_px, wm_h_px = wm
            reader = ImageReader(io.BytesIO(wm_bytes))
            wm_w = 3.5 * inch
            wm_h = wm_w * (wm_h_px / wm_w_px)
            canvas.drawImage(reader, (PAGE_W - wm_w) / 2, (PAGE_H - wm_h) / 2,
                             width=wm_w, height=wm_h, mask="auto")
        canvas.restoreState()

    frame = Frame(MARGIN, bottom, CW, PAGE_H - top - bottom,
                  leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    tpl = PageTemplate(id="inv", frames=[frame], onPage=_draw)
    doc = BaseDocTemplate(buf, pagesize=A4, pageTemplates=[tpl])
    doc.build(story)
    return buf.getvalue()


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 1. BENPOS — Beneficiary Position
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
def generate_benpos_pdf(
    company: dict,
    beneficiaries: list[dict],
    record_date: Optional[date],
    ref_no: Optional[str] = None,
    depository: Optional[str] = None,
) -> bytes:
    s_bold  = _s("bb",  "Helvetica-Bold", 11, 15)
    s_body  = _s("b",   size=11, leading=15)
    s_just  = _s("j",   size=11, leading=15, align=TA_JUSTIFY)
    s_red_c = _s("rc",  "Helvetica-Bold", 11, 15, color=RED, align=TA_CENTER)
    s_eor   = _s("eor", "Helvetica-Bold", 11, 15, align=TA_CENTER)
    s_blue  = _s("bl",  "Helvetica-Bold", 11, 15, color=BLUE)
    s_red_b = _s("rb",  "Helvetica-Bold", 11, 15, color=RED)
    s_muted = _s("mt",  size=9,  leading=12, color=DARK)
    s_hdr   = _s("th",  "Helvetica-Bold", 10, 13)
    s_cell  = _s("tc",  size=10, leading=13)
    s_right = _s("tr",  size=10, leading=13, align=TA_RIGHT)
    s_tot_l = _s("ttl", "Helvetica-Bold", 10, 13)
    s_tot_r = _s("ttr", "Helvetica-Bold", 10, 13, align=TA_RIGHT)

    story = []

    addr = _addr(company)
    name = (company.get("company_name") or "").upper()
    # Company / address block
    info = Table(
        [
            [P("Company Name",           s_bold), P(":", s_bold), P(name,         s_bold)],
            [P("Regd. / Billing Address",s_bold), P(":", s_bold), P(addr.upper(), s_bold)],
        ],
        colWidths=[CW * 0.36, 12, CW * 0.62],
    )
    info.setStyle(_no_border_ts())
    story.append(info)
    story.append(SP(8))

    # Reference number + generated date row
    rd_for_ref   = record_date.strftime("%d%m%Y") if record_date else "NA"
    dep_label    = (depository or "NSDL").upper()
    auto_ref     = f"{_rta_prefix(company)}/{dep_label}/BENPOS/{rd_for_ref}"
    effective_ref = ref_no or auto_ref
    ref_row = Table(
        [[P(f"<b>Ref No:</b> {effective_ref}", s_body),
          P(f"<b>Date:</b> {date.today().strftime('%d.%m.%Y')}",
            _s("dr", "Helvetica-Bold", 11, 15, align=TA_RIGHT))]],
        colWidths=[CW * 0.65, CW * 0.35],
    )
    ref_row.setStyle(_no_border_ts())
    story.append(ref_row)
    story.append(SP(14))

    # BENPOS title
    rd_str        = record_date.strftime("%d.%m.%Y") if record_date else "N/A"
    isin          = company.get("isin_code") or ""
    security_type = (company.get("security_type") or "EQUITY").upper()
    sec_display   = security_type.replace("SHARES", "shares")
    dep_prefix    = f"{dep_label} " if depository else ""
    story.append(P(f"{dep_prefix}BENPOS as on {rd_str} for {sec_display} ISIN: {isin}", s_red_c))
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
        free   = int(b.get("free_positions")   or 0)
        pledge = int(b.get("pledged_positions") or 0)
        total_free   += free
        total_pledge += pledge
        rows.append([
            P(str(i),                             s_right),
            P(b.get("dp_id")             or "",   s_cell),
            P(b.get("client_id")         or "",   s_right),
            P(b.get("first_holder_name") or "",   s_cell),
            P(b.get("first_holder_pan")  or "",   s_cell),
            P(f"{free:,}",                        s_right),
            P(f"{pledge:,}",                      s_right),
        ])

    rows.append([
        P("", s_cell), P("", s_cell), P("", s_cell),
        P("Total Securities", s_tot_l),
        P("", s_cell),
        P(f"{int(total_free):,}",   s_tot_r),
        P(f"{int(total_pledge):,}", s_tot_r),
    ])

    n = len(rows)
    row_bg = SKY_BLUE if dep_label == "CDSL" else PEACH
    tbl = Table(rows, colWidths=col_w, repeatRows=1)
    tbl.setStyle(_ts(
        ("BACKGROUND", (0, 0),  (-1, 0),      GRAY_MID),
        ("BACKGROUND", (0, 1),  (-1, n - 1),  row_bg),
        ("ALIGN",      (0, 0),  (-1, 0),      "CENTER"),
        ("ALIGN",      (0, 1),  (0, -1),      "RIGHT"),
        ("ALIGN",      (2, 1),  (2, -1),      "RIGHT"),
        ("ALIGN",      (5, 1),  (6, -1),      "RIGHT"),
        ("FONT",       (0, 0),  (-1, 0),      "Helvetica-Bold", 10),
        ("FONT",       (3, -1), (3, -1),      "Helvetica-Bold", 10),
        ("FONT",       (5, -1), (6, -1),      "Helvetica-Bold", 10),
        ("GRID",       (0, 0),  (-1, -1),     1.2, BLACK),
    ))
    story.append(tbl)
    story.append(SP(14))

    # End-of-report marker
    story.append(P("*** END OF REPORT ***", s_eor))
    story.append(SP(14))

    # Important Notes
    story.append(P("<b><font color='#C00000'>Important Notes: -</font></b>", s_body))
    story.append(SP(4))
    story.append(P(
        "1. This report is based on the beneficiary data provided by the respective "
        "Depository(ies) as of the reporting date and is issued on the request of the "
        "Issuer Client Company.",
        s_just,
    ))
    story.append(SP(4))
    story.append(P(
        "2. Any discrepancy or clarification relating to this report should be brought to "
        "our notice immediately at +91 9205234407 or harmilaprta@gmail.com.",
        s_just,
    ))
    story.append(SP(16))

    # Closing
    story.append(P("Thanking You", s_body))
    story.append(SP(4))
    story.append(P("REPORTING DESK", s_blue))
    story.append(P("HARMILAP SHARE TRANSFER AGENTS", s_red_b))
    story.append(SP(10))

    # System-generated remark + place + date
    story.append(P(
        "This is a system generated report, no signature is required.",
        s_muted,
    ))
    story.append(SP(6))
    story.append(P(f"Place: New Delhi", s_body))
    story.append(P(f"Date: {date.today().strftime('%d.%m.%Y')}", s_body))

    return _build_full(story, A_REPORT_HDR, _RH)


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
    isin     = company.get("isin_code") or company.get("arn_number") or ""
    name     = (company.get("company_name") or isin).upper()
    sec_type = (company.get("security_type") or "EQUITY").upper()
    today    = gen_date or date.today()
    rd       = record_date or today
    rd_long  = _date_long(rd)
    fy       = current_fy(rd)
    if ref_prefix:
        ref_no = f"{ref_prefix}/RTAN{_rta_prefix(company)}"
    else:
        ref_no = f"{fy}/NSDL/{rd.strftime('%b%y').upper()}/RTAN{_rta_prefix(company)}"

    gen_date_str = today.strftime("%d.%m.%Y")

    s_body  = _s("b",   size=10, leading=14)
    s_bold  = _s("bb",  "Helvetica-Bold", 10, 14)
    s_just  = _s("j",   size=10, leading=14, align=TA_JUSTIFY)
    s_hdr   = _s("th",  "Helvetica-Bold", 10, 13)
    s_num_b = _s("nb",  "Helvetica-Bold", 10, 13, align=TA_RIGHT)
    s_wh_c  = _s("wc",  "Helvetica-Bold", 11, 15, color=WHITE, align=TA_CENTER)
    s_red_c = _s("rdc", "Helvetica-Bold", 10, 14, color=RED)
    s_blue  = _s("rbl", "Helvetica-Bold", 10, 14, color=BLUE)
    s_red_b = _s("rrb", "Helvetica-Bold", 10, 14, color=RED)
    s_muted = _s("rmt", size=9,  leading=12, color=DARK)

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
        ("GRID",       (0, 0), (-1, -1), 1.2, BLACK),
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
    demat.setStyle(_ts(
        ("FONT", (0, 0), (-1, 0), "Helvetica-Bold", 10),
        ("GRID", (0, 0), (-1, -1), 1.2, BLACK),
    ))
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
    story.append(P("REPORTING DESK", s_blue))
    story.append(P("HARMILAP SHARE TRANSFER AGENTS", s_red_b))
    story.append(SP(10))
    story.append(P(
        "This is a system generated report, no signature is required.",
        s_muted,
    ))
    story.append(SP(6))
    story.append(P(f"Place: New Delhi", s_body))
    story.append(P(f"Date: {today.strftime('%d.%m.%Y')}", s_body))

    return _build_full(story, A_REPORT_HDR, _RH)


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

    name  = (company.get("company_name") or "").upper()
    addr  = _addr(company)
    place = _place_of_supply(company)
    bank_accounts = config.get("bank_accounts") or []

    # Theme + firm constants
    LIGHT  = HexColor("#FBE9E9")   # light red tint
    MUTED  = HexColor("#7A7A7A")
    FIRM_NAME  = "HARMILAP SHARE TRANSFER AGENTS"
    FIRM_SUB   = "(SEBI Registered Category-I Registrar &amp; Share Transfer Agent)"
    FIRM_REGS  = "SEBI Reg. No.: INR000004334  |  NSDL BP ID: IN201072  |  CDSL RTA ID: 498"
    FIRM_IDS   = ("GSTIN: 07BETPS5667B1ZY&nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;"
                  "PAN: BETPS5667B&nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;"
                  "MSME Reg. No.: UDYAM-DL-04-0005989")

    s_body  = _s("b",   size=9,  leading=12)
    s_c     = _s("c",   size=9,  leading=12, align=TA_CENTER)
    s_r     = _s("r",   size=9,  leading=12, align=TA_RIGHT)
    s_red   = _s("rd",  "Helvetica-Bold", 9, 12, color=RED)
    s_blue  = _s("ibl", "Helvetica-Bold", 9, 12, color=RED)
    s_name  = _s("inm", "Helvetica-Bold", 15, 17, color=RED)
    s_sub   = _s("isb", size=7.5, leading=9)
    s_regs  = _s("irg", size=7,   leading=9, color=DARK)
    s_ct    = _s("ict", size=7.5, leading=10, align=TA_RIGHT)
    s_idln  = _s("iid", "Helvetica-Bold", 8, 11, align=TA_CENTER)
    s_wh_t  = _s("wt",  "Helvetica-Bold", 18, 22, color=WHITE, align=TA_CENTER)
    s_sec_h = _s("ish", "Helvetica-Bold", 10, 13, color=RED)
    s_mut   = _s("mut", size=7.5, leading=10, color=MUTED)
    s_co    = _s("co",  "Helvetica-Bold", 11, 13)
    s_kv    = _s("kv",  size=8.5, leading=12)
    s_kvb   = _s("kvb", "Helvetica-Bold", 8.5, 12)

    story = []

    # ── 1. Letterhead (compact, text-based) ────────────────────────────────────
    name_block = [P(FIRM_NAME, s_name), P(FIRM_REGS, s_regs)]
    contact_block = [P("Email: harmilaprta@gmail.com", s_ct),
                     P("+91-8929835991 / 9310931755 / 9205234407", s_ct)]
    header = Table([[_invoice_logo(46), name_block, contact_block]],
                   colWidths=[60, CW * 0.60 - 60, CW * 0.40])
    header.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("LEFTPADDING", (1, 0), (1, 0), 6),
    ]))
    story.append(header)
    story.append(SP(3))

    # ── 2. Identifier strip (GSTIN / PAN / MSME) ───────────────────────────────
    idstrip = Table([[P(FIRM_IDS, s_idln)]], colWidths=[CW])
    idstrip.setStyle(TableStyle([
        ("LINEABOVE", (0, 0), (-1, -1), 1.0, RED),
        ("LINEBELOW", (0, 0), (-1, -1), 1.0, RED),
        ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(idstrip)
    story.append(SP(4))

    # ── 3. TAX INVOICE banner (centered title only) ────────────────────────────
    due_date = invoice_date + timedelta(days=30)
    banner = Table([[P("TAX INVOICE", s_wh_t)]], colWidths=[CW])
    banner.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), RED),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    story.append(banner)
    story.append(SP(5))

    # ── 4. Bill To  +  Invoice Details ─────────────────────────────────────────
    pan_gst = company.get("gst_number") or company.get("pan_number") or "N/A"
    sub_block = Table([[
        [P("PAN / GST No.", s_mut), P(pan_gst, s_kvb)],
        [P("PLACE OF SUPPLY", s_mut), P(place, s_kvb)],
    ]], colWidths=[(CW * 0.52 - 16) / 2] * 2)
    sub_block.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), LIGHT),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6), ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LINEBEFORE", (1, 0), (1, 0), 0.5, HexColor("#E0C0C0")),
    ]))
    bill_left = [
        P("BILL TO &amp; SHIP TO", s_sec_h), SP(4),
        P("Company Name", s_mut), P(name, s_co), SP(3),
        P("Registered / Billing Address", s_mut), P(addr, s_kv), SP(5),
        sub_block,
    ]

    def _kv(label, value):
        return [P(label, s_kvb), P(":", s_kv), P(value, s_kv)]
    details = Table([
        _kv("Invoice No.", invoice_no),
        _kv("Invoice Date", invoice_date.strftime("%d.%m.%Y")),
        _kv("Due Date", due_date.strftime("%d.%m.%Y")),
    ], colWidths=[CW * 0.48 * 0.42, 10, CW * 0.48 * 0.46])
    details.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 2),
        ("TOPPADDING", (0, 0), (-1, -1), 2), ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    bill_right = [P("INVOICE DETAILS", s_sec_h), SP(4), details]

    billrow = Table([[bill_left, bill_right]], colWidths=[CW * 0.52, CW * 0.48])
    billrow.setStyle(TableStyle([
        ("BOX", (0, 0), (0, 0), 1.0, RED),
        ("BOX", (1, 0), (1, 0), 1.0, RED),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(billrow)
    story.append(SP(4))

    # No. of Active ISINs
    isins = [i for i in (company.get("isins") or []) if i]
    isin_count = company.get("isin_units") or len(isins) or 1
    story.append(P(f"<b>No. of Active ISINs:</b> &nbsp;{isin_count}", _s("isn", "Helvetica-Bold", 9, 12)))
    story.append(SP(4))

    # ── 5. Services table (single, with Taxability column) ─────────────────────
    enabled = [it for it in items if it.get("enabled", True)]

    def _desc(it: dict) -> str:
        return (it.get("description") or "").replace("{fy}", fy).replace("{prev_fy}", p_fy).replace("{prev2_fy}", p2_fy)

    def m2(v: float) -> str:
        return f"{v:,.2f}"

    taxable_total     = sum(float(it.get("amount") or 0) for it in enabled if not it.get("non_taxable"))
    non_taxable_total = sum(float(it.get("amount") or 0) for it in enabled if it.get("non_taxable"))
    if gst_type == "IGST":
        cgst = sgst = utgst = 0
        igst = round(taxable_total * igst_rate / 100)
    else:
        cgst  = round(taxable_total * cgst_rate / 100)
        sgst  = round(taxable_total * sgst_rate / 100)
        igst = utgst = 0
    gst_amt = cgst + sgst + igst + utgst
    total_a = taxable_total + gst_amt
    total_b = non_taxable_total
    grand   = total_a + total_b

    s_th    = _s("th",  "Helvetica-Bold", 8.5, 11, color=WHITE, align=TA_CENTER)
    s_td    = _s("td",  size=8.5, leading=11)
    s_td_c  = _s("tdc", size=8.5, leading=11, align=TA_CENTER)
    s_td_r  = _s("tdr", size=8.5, leading=11, align=TA_RIGHT)
    s_td_red = _s("tdrd", "Helvetica-Bold", 8.5, 11, color=RED)
    s_sub_h = _s("subh", "Helvetica-Bold", 8.5, 11, color=RED)

    taxable_items = [it for it in enabled if not it.get("non_taxable")]
    nontax_items  = [it for it in enabled if it.get("non_taxable")]

    rows = [[P("S. No.", s_th), P("Description of Services", s_th),
             P("SAC Code", s_th), P("Amount (Rs.)", s_th)]]
    style_ops = [
        ("BACKGROUND", (0, 0), (-1, 0), RED),
        ("GRID", (0, 0), (-1, -1), 0.8, BLACK),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 1), (-1, -1), 3), ("BOTTOMPADDING", (0, 1), (-1, -1), 3),
    ]
    spans = []

    def _section(title: str, group: list[dict]) -> None:
        r = len(rows)
        rows.append([P(title, s_sub_h), P("", s_td), P("", s_td), P("", s_td)])
        spans.append(("SPAN", (0, r), (-1, r)))
        style_ops.append(("BACKGROUND", (0, r), (-1, r), LIGHT))
        for i, it in enumerate(group, 1):
            rows.append([
                P(str(i), s_td_c),
                P(_desc(it), s_td_red if it.get("is_red") else s_td),
                P("—" if it.get("non_taxable") else str(it.get("sac_code") or ""), s_td_c),
                P(m2(float(it.get("amount") or 0)), s_td_r),
            ])

    _section("Taxable", taxable_items)
    _section("Non-Taxable (Actual Expenses / Out-of-Pocket)", nontax_items)

    svc = Table(rows, colWidths=[CW * 0.08, CW * 0.54, CW * 0.16, CW * 0.22], repeatRows=1)
    svc.setStyle(_ts(*style_ops, *spans))
    story.append(svc)
    story.append(SP(8))

    # ── 6. Important Notes (left)  +  Invoice Summary (right) ──────────────────
    notes = [
        "GST returns are filed by us on a quarterly basis. Accordingly, no corrections, amendments, or modifications shall be possible once the relevant GST return has been filed.",
        "This invoice is issued subject to the Byelaws, Business Rules, and operational guidelines of Harmilap Share Transfer Agents and is subject to the exclusive jurisdiction of the Courts at Delhi.",
        "The payment due date for this Tax Invoice is within 30 days from the date of issue. If payment is not received within the stipulated period, interest at the rate of 18% per annum may be levied in the subsequent invoice, and this invoice may be treated as cancelled.",
        "The amount payable under this invoice should be remitted only through NEFT/RTGS or by Account Payee Cheque/Demand Draft drawn in favour of Harmilap Share Transfer Agents.",
        "Any excess payment made to the Depository or any Stamp Duty paid to the Government on behalf of the company shall be recoverable from the company.",
        "The PAN number is mentioned on the invoice only in cases where the company does not have a valid GSTIN.",
        "Kindly verify the PAN and GST details mentioned in the invoice. In case of any discrepancy, please inform us immediately so that necessary corrections can be made before the filing of GST returns. GST shall be considered in our GST return only upon receipt of payment from the Issuer Company.",
    ]
    callout_note = (
        "In the event that any dues or outstanding payments remain unpaid for more than 60 days, "
        "we reserve the right to suspend all services, deactivate the ISIN, and report the matter "
        "to the concerned Depository until all outstanding dues are fully cleared."
    )

    s_note = _s("nt", size=6.7, leading=7.3, align=TA_JUSTIFY, leftIndent=10, bulletIndent=0)
    notes_cell = [P("IMPORTANT NOTES", s_sec_h), SP(3)]
    for i, note in enumerate(notes, 1):
        notes_cell.append(Paragraph(note, s_note, bulletText=f"{i}."))
        notes_cell.append(SP(1))

    # Summary box
    s_sh   = _s("sh",  "Helvetica-Bold", 9, 12, color=WHITE)
    s_shr  = _s("shr", "Helvetica-Bold", 9, 12, color=WHITE, align=TA_RIGHT)
    s_sl   = _s("sl",  size=8.5, leading=11)
    s_slb  = _s("slb", "Helvetica-Bold", 8.5, 11)
    s_sr   = _s("sr2", size=8.5, leading=11, align=TA_RIGHT)
    s_srb  = _s("srb", "Helvetica-Bold", 8.5, 11, align=TA_RIGHT)
    s_gl   = _s("gl",  "Helvetica-Bold", 9.5, 13, color=WHITE)
    s_gr   = _s("gr",  "Helvetica-Bold", 12, 14, color=WHITE, align=TA_RIGHT)

    sum_inner = CW * 0.46
    sc = [sum_inner * 0.62, sum_inner * 0.38]
    sum_rows = [
        [P("INVOICE SUMMARY", s_sh), P("Amount (Rs.)", s_shr)],
        [P("Total Taxable Value (A)", s_slb), P(m2(taxable_total), s_srb)],
        [P(f"CGST @ {cgst_rate:.0f}%", s_sl), P(m2(cgst), s_sr)],
        [P(f"SGST @ {sgst_rate:.0f}%", s_sl), P(m2(sgst), s_sr)],
        [P(f"IGST @ {igst_rate:.0f}%", s_sl), P(m2(igst), s_sr)],
        [P(f"UTGST @ {igst_rate:.0f}%", s_sl), P(m2(utgst), s_sr)],
        [P("Total Amount to be Paid (In Figures) - A", s_slb), P(m2(total_a), s_srb)],
        [P("Non-Taxable Value (B)<br/><font size=7>(Actual Expenses / Out-of-Pocket)</font>", s_sl), P(m2(total_b), s_sr)],
        [P("Total Amount to be Paid (In Figures) (A + B)", s_gl), P(f"Rs. {m2(grand)}", s_gr)],
    ]
    summary = Table(sum_rows, colWidths=sc)
    summary.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), RED),
        ("BACKGROUND", (0, 1), (-1, 1), LIGHT),
        ("BACKGROUND", (0, 6), (-1, 6), LIGHT),
        ("BACKGROUND", (0, 7), (-1, 7), HexColor("#EAF5EA")),
        ("BACKGROUND", (0, 8), (-1, 8), RED),
        ("GRID", (0, 0), (-1, -1), 0.6, HexColor("#D8B8B8")),
        ("BOX", (0, 0), (-1, -1), 1.0, RED),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 2), ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("LEFTPADDING", (0, 0), (-1, -1), 7), ("RIGHTPADDING", (0, 0), (-1, -1), 7),
    ]))

    ns = Table([[notes_cell, summary]], colWidths=[CW * 0.50, CW * 0.50])
    ns.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (0, 0), 0), ("RIGHTPADDING", (0, 0), (0, 0), 12),
        ("LEFTPADDING", (1, 0), (1, 0), 0), ("RIGHTPADDING", (1, 0), (1, 0), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(ns)
    story.append(SP(4))

    # Total amount in words
    words = Table([[P(f"<b>Total Amount (in words):</b> {_amount_in_words(grand)}",
                      _s("aiw", size=8.5, leading=12))]], colWidths=[CW])
    words.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), LIGHT),
        ("BOX", (0, 0), (-1, -1), 0.8, RED),
        ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(words)
    story.append(SP(5))

    # ── 7. Red warning callout ─────────────────────────────────────────────────
    callout = Table([[P("!", _s("ex", "Helvetica-Bold", 16, 18, color=WHITE, align=TA_CENTER)),
                      P(callout_note, _s("co2", size=8, leading=11))]],
                    colWidths=[26, CW - 26])
    callout.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), RED),
        ("BACKGROUND", (1, 0), (1, 0), LIGHT),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (1, 0), (1, 0), 8), ("RIGHTPADDING", (1, 0), (1, 0), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(callout)
    story.append(SP(3))

    # ── 8. Bank account details (configurable) + signature note ────────────────
    s_bk_t = _s("bkt", "Helvetica-Bold", 8.5, 11, color=WHITE, align=TA_CENTER)
    s_bk_l = _s("bkl", "Helvetica-Bold", 7.5, 10)
    s_bk_v = _s("bkv", size=7.5, leading=10)

    def _bank_table(ba: dict, width: float):
        title = ba.get("title") or "Bank Account"
        details = [d for d in (ba.get("details") or []) if (d.get("label") or d.get("value"))]
        brows = [[P(title, s_bk_t), P("", s_bk_v)]]
        for d in details:
            brows.append([P(str(d.get("label") or ""), s_bk_l), P(str(d.get("value") or ""), s_bk_v)])
        bt = Table(brows, colWidths=[width * 0.40, width * 0.60])
        bt.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), RED),
            ("SPAN", (0, 0), (-1, 0)),
            ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#D8B8B8")),
            ("BOX", (0, 0), (-1, -1), 0.8, RED),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 5), ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ("TOPPADDING", (0, 0), (-1, -1), 2.5), ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
        ]))
        return bt

    banks = [b for b in bank_accounts[:2] if (b.get("title") or b.get("details"))]
    sig_block = [P("This is a system generated report, no signature is required.",
                   _s("sg", size=8, leading=11, color=DARK)),
                 SP(6),
                 P("<b>Place:</b> New Delhi", s_kv),
                 P(f"<b>Date:</b> {invoice_date.strftime('%d.%m.%Y')}", s_kv)]

    if banks:
        story.append(P("Bank Account Details — payment by NEFT / RTGS / IMPS",
                       _s("bkh", "Helvetica-Bold", 8.5, 11, color=RED)))
        story.append(SP(4))
        if len(banks) == 2:
            cols = [CW * 0.34, CW * 0.34, CW * 0.32]
            cells = [_bank_table(banks[0], cols[0]), _bank_table(banks[1], cols[1]), sig_block]
        else:
            cols = [CW * 0.46, CW * 0.54]
            cells = [_bank_table(banks[0], cols[0]), sig_block]
        pay = Table([cells], colWidths=cols)
        pay.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-2, -1), 10),
            ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ]))
        story.append(pay)
    else:
        for f in sig_block:
            story.append(f)
    story.append(SP(4))

    # ── 9. Thank-you bar ───────────────────────────────────────────────────────
    ftr = Table([[P("Thanking You for Choosing us as your Registrar and Share Transfer Agents",
                    _s("ty", "Helvetica-Bold", 8.5, 11, color=WHITE, align=TA_CENTER))]],
                colWidths=[CW])
    ftr.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), RED),
        ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(ftr)

    return _build_invoice(story)


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
