import re
import uuid
from datetime import datetime

from pydantic import BaseModel, field_validator, model_validator

# All Indian States + Union Territories (single-select dropdown values)
INDIAN_STATES_UTS = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
    "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
    "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan",
    "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
    "Andaman and Nicobar Islands", "Chandigarh",
    "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir", "Ladakh",
    "Lakshadweep", "Puducherry",
]
_STATES_SET = set(INDIAN_STATES_UTS)

_ISIN_RE = re.compile(r"^[A-Z]{2}[A-Z0-9]{9}[0-9]$")
# 2-digit state + 10-char PAN (5 letters, 4 digits, 1 letter) + entity + 'Z' + check
_GST_RE = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$")
_PAN_RE = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]$")
_PIN_RE = re.compile(r"^[0-9]{6}$")


def _non_negative(v: int | None) -> int | None:
    if v is not None and v < 0:
        raise ValueError("Value cannot be negative")
    return v


def _isin_check_digit_ok(isin: str) -> bool:
    """ISIN Luhn check: letters → numbers (A=10..Z=35), then mod-10 Luhn over the digits."""
    s = "".join(str(ord(c) - 55) if c.isalpha() else c for c in isin)
    total, dbl = 0, False
    for ch in reversed(s):
        d = int(ch)
        if dbl:
            d *= 2
            if d > 9:
                d -= 9
        total += d
        dbl = not dbl
    return total % 10 == 0


def _validate_isin(v: str | None) -> str | None:
    """ISIN = 2 letters (country) + 9 alphanumeric + 1 numeric check digit (Luhn)."""
    if v is None:
        return None
    v = v.strip().upper()
    if not v:
        return None
    if not _ISIN_RE.match(v):
        raise ValueError("ISIN must be 12 characters: 2 letters + 9 alphanumeric + 1 check digit")
    if not _isin_check_digit_ok(v):
        raise ValueError("ISIN check digit is invalid")
    return v


def _validate_gst(v: str | None) -> str | None:
    """GSTIN = 15 chars: 2-digit state + 10-char PAN + entity char + 'Z' + check char."""
    if v is None:
        return None
    v = v.strip().upper()
    if not v:
        return None
    if not _GST_RE.match(v):
        raise ValueError("GST number must be 15 characters: NNAAAAANNNNA1ZC "
                         "(state code + PAN + entity + Z + check)")
    return v


def _validate_pan(v: str | None) -> str | None:
    """PAN = 10 chars: 5 letters + 4 digits + 1 letter (e.g. AAACC1234F)."""
    if v is None:
        return None
    v = v.strip().upper()
    if not v:
        return None
    if not _PAN_RE.match(v):
        raise ValueError("PAN must be 10 characters: 5 letters + 4 digits + 1 letter")
    return v


def _validate_pincode(v: str | None) -> str | None:
    if v is None:
        return None
    v = str(v).strip()
    if not v:
        return None
    if not _PIN_RE.match(v):
        raise ValueError("Pin Code must be exactly 6 digits")
    return v


def _validate_state(v: str | None) -> str | None:
    if v is None:
        return None
    v = v.strip()
    if not v:
        return None
    if v not in _STATES_SET:
        raise ValueError("State must be a valid Indian State / Union Territory")
    return v


def _normalize_arn(v: str | None) -> str | None:
    """ARN is a free-form identifier — just trim and uppercase."""
    if v is None:
        return None
    v = v.strip().upper()
    return v or None


def _validate_nsdl_rta(v: str | None) -> str | None:
    """An NSDL RTA code must always contain the 'RTAN' substring."""
    if v is None:
        return None
    v = v.strip()
    if not v:
        return None
    if "RTAN" not in v.upper():
        raise ValueError("NSDL RTA Code must contain 'RTAN'")
    return v


class CompanyBase(BaseModel):
    company_name: str | None = None
    isin_code: str | None = None
    arn_number: str | None = None
    nsdl_rta_code: str | None = None
    cdsl_rta_code: str | None = None
    email_ids: list[str] = []
    contact_numbers: list[str] = []
    authorized_person_name: str | None = None
    authorized_person_designation: str | None = None
    gst_number: str | None = None
    tan_number: str | None = None
    pan_number: str | None = None
    pan_holder_type: str | None = None  # derived from PAN
    reg_address_line1: str | None = None
    reg_address_line2: str | None = None
    reg_address_line3: str | None = None
    reg_address_line4: str | None = None
    reg_city: str | None = None
    state: str | None = None
    reg_pin_code: str | None = None
    billing_address: str | None = None
    security_type: str | None = None
    face_value: float | None = None
    total_shares: int | None = None
    has_nsdl_shares: bool = False
    nsdl_shares: int | None = None
    has_cdsl_shares: bool = False
    cdsl_shares: int | None = None
    physical_shares: int | None = None

    # Format validators run on BOTH read and write — the DB is cleaned so every
    # stored value is valid or null (see the startup cleanup migration).
    @field_validator("isin_code")
    @classmethod
    def validate_isin(cls, v: str | None) -> str | None:
        return _validate_isin(v)

    @field_validator("arn_number")
    @classmethod
    def validate_arn(cls, v: str | None) -> str | None:
        return _normalize_arn(v)

    @field_validator("nsdl_rta_code")
    @classmethod
    def validate_nsdl_rta(cls, v: str | None) -> str | None:
        return _validate_nsdl_rta(v)

    @field_validator("gst_number")
    @classmethod
    def validate_gst(cls, v: str | None) -> str | None:
        return _validate_gst(v)

    @field_validator("pan_number")
    @classmethod
    def validate_pan(cls, v: str | None) -> str | None:
        return _validate_pan(v)

    @field_validator("reg_pin_code")
    @classmethod
    def validate_pincode(cls, v: str | None) -> str | None:
        return _validate_pincode(v)

    @field_validator("state")
    @classmethod
    def validate_state(cls, v: str | None) -> str | None:
        return _validate_state(v)


class CompanyCreate(CompanyBase):
    # physical_shares is derived (total − NSDL − CDSL) server-side, so it is not validated here.
    @field_validator("total_shares", "nsdl_shares", "cdsl_shares")
    @classmethod
    def validate_shares(cls, v: int | None) -> int | None:
        return _non_negative(v)

    @model_validator(mode="after")
    def require_isin_or_arn(self) -> "CompanyCreate":
        if not self.isin_code and not self.arn_number:
            raise ValueError("Either an ISIN code or an ARN number is required")
        return self


class CompanyUpdate(BaseModel):
    company_name: str | None = None
    isin_code: str | None = None
    arn_number: str | None = None
    nsdl_rta_code: str | None = None
    cdsl_rta_code: str | None = None
    email_ids: list[str] | None = None
    contact_numbers: list[str] | None = None
    authorized_person_name: str | None = None
    authorized_person_designation: str | None = None
    gst_number: str | None = None
    tan_number: str | None = None
    pan_number: str | None = None
    reg_address_line1: str | None = None
    reg_address_line2: str | None = None
    reg_address_line3: str | None = None
    reg_address_line4: str | None = None
    reg_city: str | None = None
    state: str | None = None
    reg_pin_code: str | None = None
    billing_address: str | None = None
    security_type: str | None = None
    face_value: float | None = None
    total_shares: int | None = None
    has_nsdl_shares: bool | None = None
    nsdl_shares: int | None = None
    has_cdsl_shares: bool | None = None
    cdsl_shares: int | None = None
    physical_shares: int | None = None

    @field_validator("isin_code")
    @classmethod
    def validate_isin(cls, v: str | None) -> str | None:
        return _validate_isin(v)

    @field_validator("arn_number")
    @classmethod
    def validate_arn(cls, v: str | None) -> str | None:
        return _normalize_arn(v)

    @field_validator("nsdl_rta_code")
    @classmethod
    def validate_nsdl_rta(cls, v: str | None) -> str | None:
        return _validate_nsdl_rta(v)

    @field_validator("gst_number")
    @classmethod
    def validate_gst(cls, v: str | None) -> str | None:
        return _validate_gst(v)

    @field_validator("pan_number")
    @classmethod
    def validate_pan(cls, v: str | None) -> str | None:
        return _validate_pan(v)

    @field_validator("reg_pin_code")
    @classmethod
    def validate_pincode(cls, v: str | None) -> str | None:
        return _validate_pincode(v)

    @field_validator("state")
    @classmethod
    def validate_state(cls, v: str | None) -> str | None:
        return _validate_state(v)

    # physical_shares is derived (total − NSDL − CDSL) server-side, so it is not validated here.
    @field_validator("total_shares", "nsdl_shares", "cdsl_shares")
    @classmethod
    def validate_shares(cls, v: int | None) -> int | None:
        return _non_negative(v)


class CompanyOut(CompanyBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    created_by: uuid.UUID | None = None
    updated_by: uuid.UUID | None = None

    model_config = {"from_attributes": True}


class CompanyListOut(BaseModel):
    id: uuid.UUID
    isin_code: str | None
    arn_number: str | None
    company_name: str | None
    nsdl_rta_code: str | None
    cdsl_rta_code: str | None
    security_type: str | None
    face_value: float | None
    total_shares: int | None
    has_nsdl_shares: bool
    has_cdsl_shares: bool
    updated_at: datetime

    model_config = {"from_attributes": True}


class IngestResult(BaseModel):
    created: int
    updated: int
    skipped: int
    errors: list[str]


class CompanyStats(BaseModel):
    beneficiary_count: int
    invoice_count: int
