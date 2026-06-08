import uuid
from datetime import datetime

from pydantic import BaseModel


class CompanyBase(BaseModel):
    company_name: str | None = None
    isin_code: str
    rta_code: str | None = None
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


class CompanyCreate(CompanyBase):
    pass


class CompanyUpdate(BaseModel):
    company_name: str | None = None
    rta_code: str | None = None
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
    rta_code: str | None
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
