"""
Excel ingestion and export for the companies table.

Import column headers (exact match required):
  Company Name, ISIN Code, RTA Code, Email Id, Contact Number,
  Authorized Person name, Designation of Authorized Person,
  GST number, TAN number, PAN number,
  Address Line 1, Address Line 2, Address Line 3, Address Line 4,
  City, Pin Code, Billing Address, Security Type,
  Total Shares, Has NSDL Shares?, NSDL Shares,
  Has CDSL Shares?, CDSL Shares, Physical Shares
"""

import io
from typing import Any

import pandas as pd
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter

# Mapping: Excel column header -> model field name
COLUMN_MAP: dict[str, str] = {
    "Company Name": "company_name",
    "ISIN Code": "isin_code",
    "RTA Code": "rta_code",
    "Email Id": "email_ids",
    "Contact Number": "contact_numbers",
    "Authorized Person name": "authorized_person_name",
    "Designation of Authorized Person": "authorized_person_designation",
    "GST number": "gst_number",
    "TAN number": "tan_number",
    "PAN number": "pan_number",
    "Address Line 1": "reg_address_line1",
    "Address Line 2": "reg_address_line2",
    "Address Line 3": "reg_address_line3",
    "Address Line 4": "reg_address_line4",
    "City": "reg_city",
    "Pin Code": "reg_pin_code",
    "Billing Address": "billing_address",
    "Security Type": "security_type",
    "Total Shares": "total_shares",
    "Has NSDL Shares?": "has_nsdl_shares",
    "NSDL Shares": "nsdl_shares",
    "Has CDSL Shares?": "has_cdsl_shares",
    "CDSL Shares": "cdsl_shares",
    "Physical Shares": "physical_shares",
}

ARRAY_FIELDS = {"email_ids", "contact_numbers"}
BOOL_FIELDS = {"has_nsdl_shares", "has_cdsl_shares"}
INT_FIELDS = {"total_shares", "nsdl_shares", "cdsl_shares", "physical_shares"}

# Reverse map for export
REVERSE_MAP = {v: k for k, v in COLUMN_MAP.items()}

EXPORT_COLUMNS = [
    "company_name", "isin_code", "rta_code", "email_ids", "contact_numbers",
    "authorized_person_name", "authorized_person_designation",
    "gst_number", "tan_number", "pan_number",
    "reg_address_line1", "reg_address_line2", "reg_address_line3", "reg_address_line4",
    "reg_city", "reg_pin_code", "billing_address", "security_type",
    "total_shares", "has_nsdl_shares", "nsdl_shares",
    "has_cdsl_shares", "cdsl_shares", "physical_shares",
]


def _clean_str(val: Any) -> str | None:
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None
    return str(val).strip() or None


def _clean_bool(val: Any) -> bool:
    if isinstance(val, bool):
        return val
    if isinstance(val, (int, float)):
        return bool(val)
    if isinstance(val, str):
        return val.strip().lower() in {"true", "yes", "1", "y"}
    return False


def _clean_int(val: Any) -> int | None:
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None
    try:
        return int(val)
    except (ValueError, TypeError):
        return None


def _clean_array(val: Any) -> list[str]:
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return []
    return [v.strip() for v in str(val).split(",") if v.strip()]


def parse_excel(file_bytes: bytes) -> tuple[list[dict], list[str]]:
    """
    Parse uploaded Excel file.
    Returns (rows, errors) where each row is a dict of model fields.
    Only columns present in the file are included in each row dict.
    """
    errors: list[str] = []
    rows: list[dict] = []

    try:
        df = pd.read_excel(io.BytesIO(file_bytes), dtype=str)
    except Exception as e:
        return [], [f"Could not read Excel file: {e}"]

    # Only process known columns
    known_cols = {col: COLUMN_MAP[col] for col in df.columns if col in COLUMN_MAP}

    if "ISIN Code" not in known_cols:
        return [], ["Column 'ISIN Code' is required in the Excel file."]

    for idx, row in df.iterrows():
        row_num = idx + 2  # 1-indexed + header row
        isin_raw = _clean_str(row.get("ISIN Code"))
        if not isin_raw:
            errors.append(f"Row {row_num}: ISIN Code is empty, skipping.")
            continue

        record: dict = {}
        for excel_col, field in known_cols.items():
            raw = row.get(excel_col)
            if field in ARRAY_FIELDS:
                record[field] = _clean_array(raw)
            elif field in BOOL_FIELDS:
                record[field] = _clean_bool(raw)
            elif field in INT_FIELDS:
                record[field] = _clean_int(raw)
            else:
                record[field] = _clean_str(raw)

        rows.append(record)

    return rows, errors


def build_export_excel(companies: list[dict]) -> bytes:
    """Build a styled Excel file from a list of company dicts."""
    wb = Workbook()
    ws = wb.active
    ws.title = "Companies"

    headers = [REVERSE_MAP.get(col, col) for col in EXPORT_COLUMNS]
    header_fill = PatternFill("solid", fgColor="1a1a1a")
    header_font = Font(bold=True, color="FFFFFF")

    for col_idx, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col_idx, value=header)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")
        ws.column_dimensions[get_column_letter(col_idx)].width = max(len(header) + 4, 16)

    ws.row_dimensions[1].height = 22

    for row_idx, company in enumerate(companies, 2):
        for col_idx, field in enumerate(EXPORT_COLUMNS, 1):
            val = company.get(field)
            if isinstance(val, list):
                val = ", ".join(val)
            elif isinstance(val, bool):
                val = "Yes" if val else "No"
            ws.cell(row=row_idx, column=col_idx, value=val)

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()
