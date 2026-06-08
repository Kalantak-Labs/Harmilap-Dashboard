import uuid
from datetime import datetime, date

from pydantic import BaseModel


class BeneficiaryListOut(BaseModel):
    id: uuid.UUID
    isin_code: str
    dp_id: str
    client_id: str
    record_date: date | None
    first_holder_name: str | None
    first_holder_pan: str | None
    beneficiary_type: int | None
    account_category: int | None
    free_positions: float | None
    lockin_positions: float | None
    block_positions: float | None
    pledged_positions: float | None
    ifsc: str | None
    bank_account_type: int | None
    updated_at: datetime

    model_config = {"from_attributes": True}


class BeneficiaryOut(BaseModel):
    id: uuid.UUID
    isin_code: str
    dp_id: str
    client_id: str
    record_date: date | None
    beneficiary_type: int | None
    beneficiary_sub_type: int | None
    account_category: int | None
    occupation: int | None
    beneficiary_status: int | None
    first_holder_name: str | None
    first_holder_father_husband_name: str | None
    first_holder_pan: str | None
    first_holder_email: str | None
    first_holder_mapin_id: str | None
    second_holder_name: str | None
    second_holder_father_husband_name: str | None
    second_holder_pan: str | None
    second_holder_email: str | None
    second_holder_mapin_id: str | None
    third_holder_name: str | None
    third_holder_father_husband_name: str | None
    third_holder_pan: str | None
    third_holder_email: str | None
    third_holder_mapin_id: str | None
    address_line1: str | None
    address_line2: str | None
    address_line3: str | None
    address_line4: str | None
    pin_code: str | None
    phone: str | None
    fax: str | None
    nominee_guardian_indicator: str | None
    nominee_guardian_name: str | None
    nominee_address_line1: str | None
    nominee_address_line2: str | None
    nominee_address_line3: str | None
    nominee_address_line4: str | None
    nominee_pin_code: str | None
    dob_minor: date | None
    minor_indicator: str | None
    bank_account_number: str | None
    bank_name_branch: str | None
    bank_address_line1: str | None
    bank_address_line2: str | None
    bank_address_line3: str | None
    bank_address_line4: str | None
    bank_pin_code: str | None
    micr_code: str | None
    ifsc: str | None
    bank_account_type: int | None
    rbi_reference_number: str | None
    rbi_approval_date: date | None
    sebi_registration_number: str | None
    tax_deduction_status: str | None
    free_positions: float | None
    lockin_positions: float | None
    block_positions: float | None
    pledged_positions: float | None
    pledged_lockin_positions: float | None
    unconfirmed_pledged_positions: float | None
    unconfirmed_pledged_lockin_positions: float | None
    remat_positions: float | None
    remat_lockin_positions: float | None
    idd_positions: float | None
    cm_pool_positions: float | None
    cc_settlement_positions: float | None
    rgess_flag: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ZipIngestResult(BaseModel):
    files_processed: int
    files_skipped: int
    total_created: int
    total_updated: int
    total_skipped: int
    errors: list[str]
