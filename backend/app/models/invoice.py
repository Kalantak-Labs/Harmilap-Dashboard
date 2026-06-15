import uuid
from datetime import date, datetime, timezone

from sqlalchemy import String, Boolean, Float, Date, DateTime, JSON, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Invoice(Base):
    """
    A company-level (issuer-level) tax invoice, keyed by RTA code.

    Only the RTA codes, the per-invoice particulars, GST settings, and payment
    tracking live here. Company name, PAN, GST, address and the list of ISINs are
    derived live from the `companies` table (grouped by RTA code) at render time.
    """
    __tablename__ = "invoices"
    __table_args__ = (
        UniqueConstraint("nsdl_rta_code", "cdsl_rta_code", "fiscal_year",
                         name="uq_invoice_rta_fy"),
        Index("ix_invoices_nsdl_rta_code", "nsdl_rta_code"),
        Index("ix_invoices_cdsl_rta_code", "cdsl_rta_code"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Party key — at least one is set
    nsdl_rta_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    cdsl_rta_code: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Per-invoice editable particulars (copied from the config template, then edited):
    # [{id, description, sac_code, amount, is_red, non_taxable, enabled}]
    particulars: Mapped[list] = mapped_column(JSON, nullable=False, default=list)

    # GST settings (seeded from config defaults, editable per party for multi-state)
    gst_type: Mapped[str] = mapped_column(String(20), nullable=False, default="IGST")
    igst_rate: Mapped[float] = mapped_column(Float, nullable=False, default=18.0)
    cgst_rate: Mapped[float] = mapped_column(Float, nullable=False, default=9.0)
    sgst_rate: Mapped[float] = mapped_column(Float, nullable=False, default=9.0)

    invoice_no: Mapped[str | None] = mapped_column(String(50), nullable=True)
    fiscal_year: Mapped[str] = mapped_column(String(7), nullable=False)

    # Payment tracking
    payment_status: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    payment_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    amount_paid: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Last time a PDF was generated for this invoice
    last_generated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
