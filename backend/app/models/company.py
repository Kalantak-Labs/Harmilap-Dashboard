import uuid
from datetime import datetime, timezone

from sqlalchemy import String, Boolean, BigInteger, DateTime, Text, ARRAY
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Company(Base):
    __tablename__ = "companies"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Core identifiers — a company is keyed by ISIN when present, otherwise by ARN.
    # At least one of isin_code / arn_number must be set (enforced in the schema layer).
    isin_code: Mapped[str | None] = mapped_column(String(50), unique=True, nullable=True, index=True)
    arn_number: Mapped[str | None] = mapped_column(String(50), unique=True, nullable=True, index=True)
    company_name: Mapped[str | None] = mapped_column(String(500), nullable=True)
    nsdl_rta_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    cdsl_rta_code: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Contact arrays
    email_ids: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, default=list)
    contact_numbers: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, default=list)

    # Authorized person
    authorized_person_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    authorized_person_designation: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Tax/legal identifiers
    gst_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    tan_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    pan_number: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Registered address (structured)
    reg_address_line1: Mapped[str | None] = mapped_column(Text, nullable=True)
    reg_address_line2: Mapped[str | None] = mapped_column(Text, nullable=True)
    reg_address_line3: Mapped[str | None] = mapped_column(Text, nullable=True)
    reg_address_line4: Mapped[str | None] = mapped_column(Text, nullable=True)
    reg_city: Mapped[str | None] = mapped_column(String(255), nullable=True)
    state: Mapped[str | None] = mapped_column(String(100), nullable=True)
    reg_pin_code: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Billing address (plain text)
    billing_address: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Share details
    security_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    face_value: Mapped[float | None] = mapped_column(nullable=True)
    total_shares: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    has_nsdl_shares: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    nsdl_shares: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    has_cdsl_shares: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    cdsl_shares: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    physical_shares: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

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
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    updated_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
