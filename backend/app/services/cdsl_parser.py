"""
CDSL file parsers.

RT95 (total CDSL shares per ISIN):
  Tilde-delimited. One row per ISIN.
  [0] ISIN  [4] total CDSL shares

RT02 (beneficiary positions):
  Tilde-delimited. One row per beneficiary.
  [0] ISIN  [1] BOID(16 digits = dp_id[:8] + client_id[8:])
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


def _d_ddmmyyyy(fields: list[str], idx: int) -> date | None:
    """Parse DDMMYYYY date format used in CDSL RT02."""
    v = _s(fields, idx)
    if not v or len(v) != 8:
        return None
    try:
        return date(int(v[4:8]), int(v[2:4]), int(v[0:2]))
    except (ValueError, TypeError):
        return None


def is_rt02(content: str) -> bool:
    """Detect RT02 by checking whether the first data line's field[1] is a 16-digit BOID."""
    for raw in content.splitlines():
        line = raw.strip()
        if not line:
            continue
        fields = line.split("~")
        if len(fields) < 2:
            continue
        return fields[1].strip().isdigit() and len(fields[1].strip()) == 16
    return False


def parse_rt95(content: str) -> list[dict[str, Any]]:
    """
    Parse RT95 file. Returns list of {isin, cdsl_shares}.
    Skips rows with zero shares.
    """
    results: list[dict[str, Any]] = []
    for raw in content.splitlines():
        line = raw.strip()
        if not line:
            continue
        fields = line.split("~")
        isin = _s(fields, 0)
        if not isin:
            continue
        shares = _f(fields, 4)
        if shares is None:
            continue
        results.append({"isin": isin, "cdsl_shares": int(shares)})
    return results


def parse_rt02_record(fields: list[str]) -> dict[str, Any] | None:
    """Parse one RT02 line into a dict matching the Beneficiary model."""
    isin = _s(fields, 0)
    boid = _s(fields, 1)
    if not isin or not boid or not boid.isdigit() or len(boid) != 16:
        return None

    return {
        "isin_code": isin,
        "dp_id": boid[:8],
        "client_id": boid[8:],
        "depository": "CDSL",

        # Holder
        "first_holder_name": _s(fields, 2),
        "second_holder_name": _s(fields, 6),
        "first_holder_father_husband_name": _s(fields, 7),
        "first_holder_pan": _s(fields, 16),
        "first_holder_email": _s(fields, 49),

        # Classification
        "beneficiary_type": _i(fields, 10),
        "beneficiary_sub_type": _i(fields, 11),
        "account_category": _i(fields, 12),
        "occupation": _i(fields, 14),

        # Address (registered)
        "address_line1": _s(fields, 32),
        "address_line2": _s(fields, 33),
        "address_line3": _s(fields, 34),
        "address_line4": _s(fields, 35),   # city
        "pin_code": _s(fields, 38),
        "phone": _s(fields, 46),

        # Bank
        "ifsc": _s(fields, 52),
        "bank_name_branch": _s(fields, 53),
        "bank_address_line1": _s(fields, 54),
        "bank_address_line2": _s(fields, 55),
        "bank_address_line3": _s(fields, 56),
        "bank_address_line4": _s(fields, 57),   # bank city
        "bank_pin_code": _s(fields, 60),
        "micr_code": _s(fields, 61),
        "bank_account_type": _i(fields, 62),
        "bank_account_number": _s(fields, 63),

        # Positions
        "free_positions": _f(fields, 64),
        "lockin_positions": _f(fields, 65),
        "pledged_positions": _f(fields, 66),

        # Date
        "record_date": _d_ddmmyyyy(fields, 73),
    }


def parse_rt02(content: str) -> tuple[list[dict], list[str]]:
    """
    Parse RT02 file. Returns (records, errors).
    """
    records: list[dict] = []
    errors: list[str] = []
    for line_num, raw in enumerate(content.splitlines(), 1):
        line = raw.strip()
        if not line:
            continue
        fields = line.split("~")
        rec = parse_rt02_record(fields)
        if rec is None:
            errors.append(f"Line {line_num}: skipped (bad ISIN or BOID)")
            continue
        records.append(rec)
    return records, errors
