import uuid

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Index, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.database import Base


class GeneratedInvoice(Base):
    __tablename__ = "generated_invoices"
    __table_args__ = (
        UniqueConstraint("company_id", "fiscal_year", "seq_no", name="uq_invoice_company_fy_seq"),
        Index("ix_generated_invoices_company_id", "company_id"),
    )

    id           = Column(Integer, primary_key=True, autoincrement=True)
    company_id   = Column(UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False)
    fiscal_year  = Column(String(7), nullable=False)   # e.g. "2026-27"
    seq_no       = Column(Integer, nullable=False)
    invoice_no   = Column(String(50), nullable=False)  # e.g. "RTAN4369/1"
    generated_at = Column(DateTime(timezone=True), server_default=func.now())
