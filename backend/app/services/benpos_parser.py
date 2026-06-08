"""
NSDL BENPOS file parser.
Delimiter: ## (double hash). Empty field = consecutive ## with nothing between.
Record types:
  01 = Header (one per file)
  02 = Beneficiary detail
  03 = Lock-in detail
"""

from datetime import date
from typing import Any


def _s(fields: list[str], idx: int) -> str | None:
    try:
        v = fields[idx].strip()
        return v if v else None
    except IndexError:
        return None


def _i(fields: list[str], idx: int) -> int | None:
    v = _s(fields, idx)
    if v is None:
        return None
    try:
        return int(float(v))
    except (ValueError, TypeError):
        return None


def _f(fields: list[str], idx: int) -> float | None:
    v = _s(fields, idx)
    if v is None:
        return None
    try:
        return float(v)
    except (ValueError, TypeError):
        return None


def _d(fields: list[str], idx: int) -> date | None:
    v = _s(fields, idx)
    if not v or len(v) != 8:
        return None
    try:
        return date(int(v[:4]), int(v[4:6]), int(v[6:8]))
    except (ValueError, TypeError):
        return None


def parse_header(fields: list[str]) -> dict[str, Any]:
    return {
        "isin_code": _s(fields, 1),
        "record_date": _d(fields, 2),
        "stmt_prep_date": _d(fields, 3),
        "stmt_prep_time": _s(fields, 4),
        "total_nsdl_positions": _f(fields, 5),
        "total_transit_positions": _f(fields, 6),
        "total_free_positions": _f(fields, 7),
        "total_lockin_positions": _f(fields, 8),
        "total_block_positions": _f(fields, 9),
        "total_pledged_positions": _f(fields, 10),
        "total_pledged_lockin_positions": _f(fields, 11),
        "total_unconfirmed_pledged_positions": _f(fields, 12),
        "total_unconfirmed_pledged_lockin_positions": _f(fields, 13),
        "total_olidt_positions": _f(fields, 14),
        "total_remat_positions": _f(fields, 15),
        "total_remat_lockin_positions": _f(fields, 16),
        "total_detail_records": _i(fields, -1),  # last field
    }


def parse_detail(fields: list[str], isin_code: str, record_date: date | None) -> dict[str, Any]:
    return {
        "isin_code": isin_code,
        "record_date": record_date,
        "dp_id": _s(fields, 2),
        "client_id": _s(fields, 3),
        "beneficiary_type": _i(fields, 4),
        "beneficiary_sub_type": _i(fields, 5),
        "account_category": _i(fields, 6),
        "occupation": _i(fields, 7),
        "first_holder_name": _s(fields, 8),
        "first_holder_father_husband_name": _s(fields, 9),
        "address_line1": _s(fields, 10),
        "address_line2": _s(fields, 11),
        "address_line3": _s(fields, 12),
        "address_line4": _s(fields, 13),
        "pin_code": _s(fields, 14),
        "phone": _s(fields, 15),
        "fax": _s(fields, 16),
        "second_holder_name": _s(fields, 17),
        "second_holder_father_husband_name": _s(fields, 18),
        "third_holder_name": _s(fields, 19),
        "third_holder_father_husband_name": _s(fields, 20),
        # 21, 22 = fillers
        "first_holder_pan": _s(fields, 23),
        "second_holder_pan": _s(fields, 24),
        "third_holder_pan": _s(fields, 25),
        "nominee_guardian_indicator": _s(fields, 26),
        "nominee_guardian_name": _s(fields, 27),
        "nominee_address_line1": _s(fields, 28),
        "nominee_address_line2": _s(fields, 29),
        "nominee_address_line3": _s(fields, 30),
        "nominee_address_line4": _s(fields, 31),
        "nominee_pin_code": _s(fields, 32),
        "dob_minor": _d(fields, 33),
        "minor_indicator": _s(fields, 34),
        "bank_account_number": _s(fields, 35),
        "bank_name_branch": _s(fields, 36),
        "bank_address_line1": _s(fields, 37),
        "bank_address_line2": _s(fields, 38),
        "bank_address_line3": _s(fields, 39),
        "bank_address_line4": _s(fields, 40),
        "bank_pin_code": _s(fields, 41),
        "rbi_reference_number": _s(fields, 42),
        "rbi_approval_date": _d(fields, 43),
        "sebi_registration_number": _s(fields, 44),
        "tax_deduction_status": _s(fields, 45),
        "beneficiary_status": _i(fields, 46),
        "free_positions": _f(fields, 47),
        "lockin_positions": _f(fields, 48),
        "block_positions": _f(fields, 49),
        "pledged_positions": _f(fields, 50),
        "pledged_lockin_positions": _f(fields, 51),
        "unconfirmed_pledged_positions": _f(fields, 52),
        "unconfirmed_pledged_lockin_positions": _f(fields, 53),
        "remat_positions": _f(fields, 54),
        "remat_lockin_positions": _f(fields, 55),
        "idd_positions": _f(fields, 56),
        "cm_pool_positions": _f(fields, 57),
        "cc_settlement_positions": _f(fields, 58),
        "micr_code": _s(fields, 59),
        "ifsc": _s(fields, 60),
        "bank_account_type": _i(fields, 61),
        # 62 = filler
        "first_holder_mapin_id": _s(fields, 63),
        "second_holder_mapin_id": _s(fields, 64),
        "third_holder_mapin_id": _s(fields, 65),
        "first_holder_email": _s(fields, 66),
        "second_holder_email": _s(fields, 67),
        "third_holder_email": _s(fields, 68),
        "rgess_flag": _s(fields, 69),
    }


def parse_lockin(fields: list[str], isin_code: str, record_date: date | None) -> dict[str, Any]:
    return {
        "isin_code": isin_code,
        "dp_id": _s(fields, 2),
        "client_id": _s(fields, 3),
        "record_date": record_date,
        "line_number": _i(fields, 1),
        "position_type": _i(fields, 4),
        "positions": _f(fields, 5),
        "lockin_indicator": _i(fields, 6),
        "lockin_reason_code": _i(fields, 7),
        "lockin_release_date": _d(fields, 8),
    }


def parse_benpos_file(content: str) -> tuple[dict | None, list[dict], list[dict], list[str]]:
    """
    Parse a single BENPOS txt file content.
    Returns: (header, detail_records, lockin_records, errors)
    """
    errors: list[str] = []
    header: dict | None = None
    details: list[dict] = []
    lockins: list[dict] = []

    for line_num, raw_line in enumerate(content.splitlines(), 1):
        line = raw_line.strip()
        if not line:
            continue
        fields = line.split("##")
        rec_type = fields[0].strip()

        if rec_type == "01":
            if header is not None:
                errors.append(f"Line {line_num}: duplicate header record ignored")
                continue
            header = parse_header(fields)
            if not header.get("isin_code"):
                errors.append(f"Line {line_num}: header missing ISIN")
                header = None

        elif rec_type == "02":
            if header is None:
                errors.append(f"Line {line_num}: detail record before header, skipping")
                continue
            isin = header["isin_code"]
            rec_date = header["record_date"]
            rec = parse_detail(fields, isin, rec_date)
            if not rec.get("dp_id") or not rec.get("client_id"):
                errors.append(f"Line {line_num}: missing dp_id or client_id, skipping")
                continue
            details.append(rec)

        elif rec_type == "03":
            if header is None:
                continue
            isin = header["isin_code"]
            rec_date = header["record_date"]
            rec = parse_lockin(fields, isin, rec_date)
            if rec.get("dp_id") and rec.get("client_id"):
                lockins.append(rec)

    return header, details, lockins, errors
