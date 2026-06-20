import uuid
from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, Float, ForeignKey, LargeBinary, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class InvoicePdfArchive(Base):
    """Stored PDF snapshot each time a party invoice is generated."""

    __tablename__ = "invoice_pdf_archives"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True
    )
    invoice_no: Mapped[str] = mapped_column(String(50), nullable=False)
    invoice_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    fiscal_year: Mapped[str] = mapped_column(String(7), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    grand_total: Mapped[float | None] = mapped_column(Float, nullable=True)
    pdf_data: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
