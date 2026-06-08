import uuid
from datetime import datetime, date, timezone

from sqlalchemy import String, Integer, BigInteger, DateTime, Date, Text, Numeric, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Beneficiary(Base):
    __tablename__ = "beneficiaries"
    __table_args__ = (
        UniqueConstraint("isin_code", "dp_id", "client_id", name="uq_benef_isin_dp_client"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Key
    isin_code: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    dp_id: Mapped[str] = mapped_column(String(8), nullable=False)
    client_id: Mapped[str] = mapped_column(String(20), nullable=False)
    record_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Beneficiary classification
    beneficiary_type: Mapped[int | None] = mapped_column(Integer, nullable=True)
    beneficiary_sub_type: Mapped[int | None] = mapped_column(Integer, nullable=True)
    account_category: Mapped[int | None] = mapped_column(Integer, nullable=True)
    occupation: Mapped[int | None] = mapped_column(Integer, nullable=True)
    beneficiary_status: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # First holder
    first_holder_name: Mapped[str | None] = mapped_column(String(250), nullable=True)
    first_holder_father_husband_name: Mapped[str | None] = mapped_column(String(45), nullable=True)
    first_holder_pan: Mapped[str | None] = mapped_column(String(30), nullable=True, index=True)
    first_holder_email: Mapped[str | None] = mapped_column(String(50), nullable=True)
    first_holder_mapin_id: Mapped[str | None] = mapped_column(String(9), nullable=True)

    # Second holder
    second_holder_name: Mapped[str | None] = mapped_column(String(45), nullable=True)
    second_holder_father_husband_name: Mapped[str | None] = mapped_column(String(45), nullable=True)
    second_holder_pan: Mapped[str | None] = mapped_column(String(30), nullable=True)
    second_holder_email: Mapped[str | None] = mapped_column(String(50), nullable=True)
    second_holder_mapin_id: Mapped[str | None] = mapped_column(String(9), nullable=True)

    # Third holder
    third_holder_name: Mapped[str | None] = mapped_column(String(45), nullable=True)
    third_holder_father_husband_name: Mapped[str | None] = mapped_column(String(45), nullable=True)
    third_holder_pan: Mapped[str | None] = mapped_column(String(30), nullable=True)
    third_holder_email: Mapped[str | None] = mapped_column(String(50), nullable=True)
    third_holder_mapin_id: Mapped[str | None] = mapped_column(String(9), nullable=True)

    # Address
    address_line1: Mapped[str | None] = mapped_column(String(36), nullable=True)
    address_line2: Mapped[str | None] = mapped_column(String(36), nullable=True)
    address_line3: Mapped[str | None] = mapped_column(String(36), nullable=True)
    address_line4: Mapped[str | None] = mapped_column(String(36), nullable=True)
    pin_code: Mapped[str | None] = mapped_column(String(10), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(24), nullable=True)
    fax: Mapped[str | None] = mapped_column(String(24), nullable=True)

    # Nominee / Guardian
    nominee_guardian_indicator: Mapped[str | None] = mapped_column(String(1), nullable=True)
    nominee_guardian_name: Mapped[str | None] = mapped_column(String(45), nullable=True)
    nominee_address_line1: Mapped[str | None] = mapped_column(String(36), nullable=True)
    nominee_address_line2: Mapped[str | None] = mapped_column(String(36), nullable=True)
    nominee_address_line3: Mapped[str | None] = mapped_column(String(36), nullable=True)
    nominee_address_line4: Mapped[str | None] = mapped_column(String(36), nullable=True)
    nominee_pin_code: Mapped[str | None] = mapped_column(String(10), nullable=True)
    dob_minor: Mapped[date | None] = mapped_column(Date, nullable=True)
    minor_indicator: Mapped[str | None] = mapped_column(String(1), nullable=True)

    # Bank
    bank_account_number: Mapped[str | None] = mapped_column(String(30), nullable=True)
    bank_name_branch: Mapped[str | None] = mapped_column(String(135), nullable=True)
    bank_address_line1: Mapped[str | None] = mapped_column(String(36), nullable=True)
    bank_address_line2: Mapped[str | None] = mapped_column(String(36), nullable=True)
    bank_address_line3: Mapped[str | None] = mapped_column(String(36), nullable=True)
    bank_address_line4: Mapped[str | None] = mapped_column(String(36), nullable=True)
    bank_pin_code: Mapped[str | None] = mapped_column(String(10), nullable=True)
    micr_code: Mapped[str | None] = mapped_column(String(9), nullable=True)
    ifsc: Mapped[str | None] = mapped_column(String(11), nullable=True)
    bank_account_type: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # NRI
    rbi_reference_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    rbi_approval_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Registration
    sebi_registration_number: Mapped[str | None] = mapped_column(String(24), nullable=True)
    tax_deduction_status: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Positions (from 02 record)
    free_positions: Mapped[float | None] = mapped_column(Numeric(18, 3), nullable=True)
    lockin_positions: Mapped[float | None] = mapped_column(Numeric(18, 3), nullable=True)
    block_positions: Mapped[float | None] = mapped_column(Numeric(18, 3), nullable=True)
    pledged_positions: Mapped[float | None] = mapped_column(Numeric(18, 3), nullable=True)
    pledged_lockin_positions: Mapped[float | None] = mapped_column(Numeric(18, 3), nullable=True)
    unconfirmed_pledged_positions: Mapped[float | None] = mapped_column(Numeric(18, 3), nullable=True)
    unconfirmed_pledged_lockin_positions: Mapped[float | None] = mapped_column(Numeric(18, 3), nullable=True)
    remat_positions: Mapped[float | None] = mapped_column(Numeric(18, 3), nullable=True)
    remat_lockin_positions: Mapped[float | None] = mapped_column(Numeric(18, 3), nullable=True)
    idd_positions: Mapped[float | None] = mapped_column(Numeric(18, 3), nullable=True)
    cm_pool_positions: Mapped[float | None] = mapped_column(Numeric(18, 3), nullable=True)
    cc_settlement_positions: Mapped[float | None] = mapped_column(Numeric(18, 3), nullable=True)

    # Flags
    rgess_flag: Mapped[str | None] = mapped_column(String(1), nullable=True)

    # Audit
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class BenposLockin(Base):
    __tablename__ = "benpos_lockin"
    __table_args__ = (
        UniqueConstraint(
            "isin_code", "dp_id", "client_id", "position_type", "lockin_reason_code", "lockin_release_date",
            name="uq_lockin_key",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    isin_code: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    dp_id: Mapped[str] = mapped_column(String(8), nullable=False)
    client_id: Mapped[str] = mapped_column(String(20), nullable=False)
    record_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    line_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    position_type: Mapped[int | None] = mapped_column(Integer, nullable=True)
    positions: Mapped[float | None] = mapped_column(Numeric(18, 3), nullable=True)
    lockin_indicator: Mapped[int | None] = mapped_column(Integer, nullable=True)
    lockin_reason_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    lockin_release_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
