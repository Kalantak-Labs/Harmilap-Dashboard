import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.invoice import Particular


class BillingConfigOut(BaseModel):
    line_items: list[Particular]
    gst_type: str = "IGST"
    igst_rate: float = 18.0
    cgst_rate: float = 9.0
    sgst_rate: float = 9.0
    invoice_date: date | None = None
    bank_accounts: list[dict] = []


class BillingConfigUpdate(BaseModel):
    line_items: list[Particular]
    gst_type: str = "IGST"
    igst_rate: float = 18.0
    cgst_rate: float = 9.0
    sgst_rate: float = 9.0
    invoice_date: date | None = None
    bank_accounts: list[dict] = []


class PartyBillingListOut(BaseModel):
    party_key: str
    nsdl_rta_code: str | None = None
    cdsl_rta_code: str | None = None
    company_name: str | None = None
    isin_count: int = 0
    isins: list[str] = []
    total_billed: float = 0
    total_received: float = 0
    outstanding: float = 0
    invoice_count: int = 0


class PartySettingsOut(BaseModel):
    party_key: str
    company_name: str | None = None
    isin_count: int = 0
    particulars: list[Particular]
    preview_total: float = 0


class PartySettingsUpdate(BaseModel):
    particulars: list[Particular]


class BillingInvoiceOut(BaseModel):
    id: uuid.UUID
    invoice_no: str
    invoice_date: date
    fiscal_year: str
    grand_total: float
    filename: str
    generated_at: datetime

    model_config = {"from_attributes": True}


class BillingPaymentOut(BaseModel):
    id: uuid.UUID
    amount: float
    receiving_bank: str
    reference_number: str
    received_at: date
    created_at: datetime

    model_config = {"from_attributes": True}


class PartySummaryOut(BaseModel):
    party_key: str
    company_name: str | None = None
    nsdl_rta_code: str | None = None
    cdsl_rta_code: str | None = None
    isin_count: int = 0
    total_billed: float = 0
    total_received: float = 0
    outstanding: float = 0
    invoices: list[BillingInvoiceOut] = []
    payments: list[BillingPaymentOut] = []


class GenerateInvoiceBody(BaseModel):
    invoice_no: str
    invoice_date: date


class InvoiceNoCheck(BaseModel):
    available: bool
    default_invoice_no: str | None = None


class RecordPaymentBody(BaseModel):
    amount: float = Field(gt=0)
    receiving_bank: Literal["HDFC", "IDFC"]
    reference_number: str = Field(min_length=1)
    received_at: date
