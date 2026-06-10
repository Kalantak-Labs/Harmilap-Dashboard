import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, field_validator


def _non_negative(v: int | None) -> int | None:
    if v is not None and v < 0:
        raise ValueError("Value cannot be negative")
    return v


class CompanyBase(BaseModel):
    company_name: str | None = None
    isin_code: str
    nsdl_rta_code: str | None = None
    cdsl_rta_code: str | None = None
    email_ids: list[str] = []
    contact_numbers: list[str] = []
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
    reg_pin_code: str | None = None
    billing_address: str | None = None
    security_type: str | None = None
    total_shares: int | None = None
    has_nsdl_shares: bool = False
    nsdl_shares: int | None = None
    has_cdsl_shares: bool = False
    cdsl_shares: int | None = None
    physical_shares: int | None = None

    @field_validator("isin_code")
    @classmethod
    def validate_isin(cls, v: str) -> str:
        v = v.strip().upper()
        if len(v) != 12:
            raise ValueError(f"ISIN must be exactly 12 characters (got {len(v)})")
        if not v.isalnum():
            raise ValueError("ISIN must contain only letters and numbers")
        return v

    @field_validator("total_shares", "nsdl_shares", "cdsl_shares", "physical_shares")
    @classmethod
    def validate_shares(cls, v: int | None) -> int | None:
        return _non_negative(v)


class CompanyCreate(CompanyBase):
    pass


class CompanyUpdate(BaseModel):
    company_name: str | None = None
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
    reg_pin_code: str | None = None
    billing_address: str | None = None
    security_type: str | None = None
    total_shares: int | None = None
    has_nsdl_shares: bool | None = None
    nsdl_shares: int | None = None
    has_cdsl_shares: bool | None = None
    cdsl_shares: int | None = None
    physical_shares: int | None = None

    @field_validator("total_shares", "nsdl_shares", "cdsl_shares", "physical_shares")
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
    isin_code: str
    company_name: str | None
    nsdl_rta_code: str | None
    cdsl_rta_code: str | None
    security_type: str | None
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
