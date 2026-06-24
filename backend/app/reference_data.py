"""Canonical reference mappings used across validation, PDF generation, and seeding."""

# GST state code (first 2 digits of a GSTIN) → State / Union Territory
GST_STATE_CODES: dict[str, str] = {
    "01": "Jammu and Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh",
    "05": "Uttarakhand", "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh",
    "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur",
    "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal",
    "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
    "26": "Dadra and Nagar Haveli and Daman and Diu", "27": "Maharashtra", "29": "Karnataka",
    "30": "Goa", "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry",
    "35": "Andaman and Nicobar Islands", "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh",
}

# PAN 4th character → holder type
PAN_HOLDER_TYPES: dict[str, str] = {
    "P": "Individual / Person",
    "C": "Company",
    "H": "HUF (Hindu Undivided Family)",
    "F": "Firm / LLP",
    "A": "Association of Persons (AOP)",
    "T": "Trust",
    "B": "Body of Individuals (BOI)",
    "L": "Local Authority",
    "J": "Artificial Juridical Person",
    "G": "Government",
}

# ISIN security type — keyed by (issuer prefix = chars 1–3, security code = chars 8–9).
# The same code maps differently by prefix (e.g. "01" is Equity for INE/IN9 but a
# Mutual Fund Unit for INF), so both parts are required.
ISIN_SECURITY_TYPES: dict[tuple[str, str], str] = {
    ("INE", "01"): "Equity Share",
    ("IN9", "01"): "Equity Share",
    ("INF", "01"): "Mutual Fund Unit",
    ("INE", "02"): "Postal Savings Scheme",
    ("INE", "03"): "Preference Share",
    ("IN9", "03"): "Preference Share",
    ("INE", "04"): "Preference Share",
    ("IN9", "04"): "Preference Share",
    ("INE", "05"): "Deep Discount Bond",
    ("INE", "06"): "Floating Rate Bond",
    ("INE", "07"): "Bond / Debenture",
    ("INE", "08"): "Bond / Debenture",
    ("INE", "09"): "Bond / Debenture",
    ("INE", "10"): "Floating Rate Bond",
    ("INE", "11"): "Bonds",
    ("INE", "13"): "Warrants",
    ("INE", "14"): "Commercial Paper",
    ("INE", "15"): "Securitised Instrument",
    ("INE", "16"): "Certificate of Deposit",
    ("INE", "18"): "Securitised Instrument",
    ("IN9", "19"): "Mutual Fund Unit",
    ("INF", "19"): "Mutual Fund Unit",
    ("INF", "1A"): "Mutual Fund Unit",
    ("INE", "20"): "Rights Entitlement",
    ("INE", "21"): "Indian Depository Receipt",
    ("INF", "22"): "Alternate Investment Fund",
    ("INE", "23"): "Infrastructure Investment Trust",
    ("INE", "24"): "Municipal Bond",
    ("INE", "25"): "Real Estate Investment Trusts",
    ("INF", "A1"): "Mutual Fund Unit",
    ("INE", "A7"): "Debenture",
    ("INF", "B1"): "Mutual Fund Unit",
    ("INE", "B7"): "Debenture",
    ("INF", "C1"): "Mutual Fund Unit",
}


def security_type_from_isin(isin: str | None) -> str | None:
    """Derive security type from ISIN prefix (chars 1–3) + security code (chars 8–9)."""
    if not isin:
        return None
    code = isin.strip().upper()
    if len(code) < 9:
        return None
    return ISIN_SECURITY_TYPES.get((code[:3], code[7:9]))
