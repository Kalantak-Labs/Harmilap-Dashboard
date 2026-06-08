from sqlalchemy import Column, Integer, String, Float, JSON, DateTime
from sqlalchemy.sql import func
from app.database import Base

DEFAULT_LINE_ITEMS = [
    {
        "id": 1,
        "description": "RTA Annual Maintenance Charges for FY {fy} for Active ISINs",
        "sac_code": "997159",
        "amount": 3500,
        "is_red": False,
        "non_taxable": False,
        "enabled": True,
    },
    {
        "id": 2,
        "description": "RTA Annual Maintenance Charges for FY {prev_fy} for Active ISINs (if Outstanding)",
        "sac_code": "997159",
        "amount": 3500,
        "is_red": True,
        "non_taxable": False,
        "enabled": False,
    },
    {
        "id": 3,
        "description": "RTA Annual Maintenance Charges for FY {prev2_fy} for Active ISINs (if Outstanding)",
        "sac_code": "997159",
        "amount": 0,
        "is_red": True,
        "non_taxable": False,
        "enabled": False,
    },
    {
        "id": 4,
        "description": "ESTAMP Fees for Tripartite Agreement (if pending)",
        "sac_code": "On Actuals",
        "amount": 0,
        "is_red": False,
        "non_taxable": True,
        "enabled": True,
    },
    {
        "id": 5,
        "description": "Non-Compliance Charges / Interest on Outstanding Fees",
        "sac_code": "997159",
        "amount": 0,
        "is_red": False,
        "non_taxable": False,
        "enabled": True,
    },
]


class InvoiceConfig(Base):
    __tablename__ = "invoice_config"

    id = Column(Integer, primary_key=True, default=1)
    line_items = Column(JSON, nullable=False, default=DEFAULT_LINE_ITEMS)
    gst_type = Column(String, nullable=False, default="IGST")  # "IGST" or "CGST_SGST"
    igst_rate = Column(Float, nullable=False, default=18.0)
    cgst_rate = Column(Float, nullable=False, default=9.0)
    sgst_rate = Column(Float, nullable=False, default=9.0)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
