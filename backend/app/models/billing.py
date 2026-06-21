import uuid
from datetime import date, datetime, timezone

from sqlalchemy import String, Float, Date, DateTime, JSON, UniqueConstraint, Index, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class BillingPartySettings(Base):
    """Per-party override for particulars and prices only."""

    __tablename__ = "billing_party_settings"
    __table_args__ = (
        UniqueConstraint("nsdl_rta_code", "cdsl_rta_code", name="uq_billing_party_rta"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nsdl_rta_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    cdsl_rta_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    particulars: Mapped[list | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class BillingInvoice(Base):
    """Immutable generated invoice record — one row per PDF generation."""

    __tablename__ = "billing_invoices"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nsdl_rta_code: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    cdsl_rta_code: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    invoice_no: Mapped[str] = mapped_column(String(50), nullable=False, unique=True, index=True)
    invoice_date: Mapped[date] = mapped_column(Date, nullable=False)
    fiscal_year: Mapped[str] = mapped_column(String(7), nullable=False, index=True)
    particulars: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    gst_type: Mapped[str] = mapped_column(String(20), nullable=False, default="IGST")
    igst_rate: Mapped[float] = mapped_column(Float, nullable=False, default=18.0)
    cgst_rate: Mapped[float] = mapped_column(Float, nullable=False, default=9.0)
    sgst_rate: Mapped[float] = mapped_column(Float, nullable=False, default=9.0)
    grand_total: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    is_manual: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    s3_key: Mapped[str] = mapped_column(String(512), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    generated_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )


class BillingPayment(Base):
    """Payment received against a billing party (aggregate, not per-invoice)."""

    __tablename__ = "billing_payments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nsdl_rta_code: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    cdsl_rta_code: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    receiving_bank: Mapped[str] = mapped_column(String(20), nullable=False)
    reference_number: Mapped[str] = mapped_column(String(100), nullable=False)
    received_at: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
