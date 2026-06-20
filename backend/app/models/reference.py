from sqlalchemy import Column, String

from app.database import Base


class GstStateCode(Base):
    """GST state code → State / UT (seeded reference table)."""
    __tablename__ = "gst_state_codes"
    code = Column(String(2), primary_key=True)
    state = Column(String(100), nullable=False)


class PanHolderType(Base):
    """PAN 4th-character → holder type (seeded reference table)."""
    __tablename__ = "pan_holder_types"
    code = Column(String(1), primary_key=True)
    meaning = Column(String(100), nullable=False)


class IsinSecurityType(Base):
    """ISIN digits 8–9 → security type (seeded reference table)."""
    __tablename__ = "isin_security_types"
    code = Column(String(2), primary_key=True)
    security_type = Column(String(200), nullable=False)
