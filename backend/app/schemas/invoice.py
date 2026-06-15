import uuid
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel


class Particular(BaseModel):
    id: int
    description: str
    sac_code: str = "997159"
    amount: float = 0
    is_red: bool = False
    non_taxable: bool = False
    enabled: bool = True


class PartyListOut(BaseModel):
    """A derived issuer (group of ISIN rows sharing an RTA code)."""
    party_key: str
    nsdl_rta_code: str | None = None
    cdsl_rta_code: str | None = None
    company_name: str | None = None
    isin_count: int = 0
    isins: list[str] = []
    invoice_no: str | None = None
    grand_total: float = 0
    payment_status: bool = False
    payment_date: date | None = None
    amount_paid: float | None = None
    has_record: bool = False


class InvoiceOut(BaseModel):
    id: uuid.UUID | None = None
    party_key: str
    nsdl_rta_code: str | None = None
    cdsl_rta_code: str | None = None
    company_name: str | None = None
    pan_number: str | None = None
    gst_number: str | None = None
    billing_address: str | None = None
    isins: list[str] = []
    particulars: list[Particular] = []
    gst_type: str = "IGST"
    igst_rate: float = 18.0
    cgst_rate: float = 9.0
    sgst_rate: float = 9.0
    invoice_no: str | None = None
    fiscal_year: str | None = None
    payment_status: bool = False
    payment_date: date | None = None
    amount_paid: float | None = None
    grand_total: float = 0


class InvoiceUpdate(BaseModel):
    particulars: list[Particular] | None = None
    gst_type: str | None = None
    igst_rate: float | None = None
    cgst_rate: float | None = None
    sgst_rate: float | None = None
    payment_status: bool | None = None
    payment_date: date | None = None
    amount_paid: float | None = None


class InvoiceZipResult(BaseModel):
    created: int = 0
    updated: int = 0
    generated: int = 0
    errors: list[str] = []
