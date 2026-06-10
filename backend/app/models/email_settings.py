import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class EmailSettings(Base):
    """Singleton row (id=1) storing SMTP configuration."""
    __tablename__ = "email_settings"

    id            = Column(Integer, primary_key=True, default=1)
    smtp_host     = Column(String(255), nullable=True)
    smtp_port     = Column(Integer, default=587, nullable=False)
    smtp_username = Column(String(255), nullable=True)
    smtp_password = Column(String(255), nullable=True)
    smtp_use_tls  = Column(Boolean, default=True, nullable=False)
    sender_name   = Column(String(100), nullable=True)
    sender_email  = Column(String(255), nullable=True)
    updated_at    = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class EmailTemplate(Base):
    __tablename__ = "email_templates"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email_type = Column(String(20), nullable=False, index=True)  # invoice|benpos|reconciliation
    name       = Column(String(100), nullable=False)
    subject    = Column(String(300), nullable=False)
    body       = Column(Text, nullable=False, default="")
    is_default = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
