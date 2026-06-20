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

# ISIN digits 8–9 (1-indexed) → security type (NSDL depository classification)
ISIN_SECURITY_TYPES: dict[str, str] = {
    "01": "Equity shares",
    "02": "Preference shares",
    "03": "Partly convertible debentures",
    "04": "Fully convertible debentures",
    "05": "Non-convertible debentures / bonds",
    "06": "Warrants / rights / entitlement-type instruments",
    "07": "Government / PSU / institutional debt-type securities",
    "08": "Mutual fund units",
    "09": "Commercial paper / certificate of deposit / money-market debt",
    "10": "Securitised / pass-through / structured debt-type instruments",
    "11": "Treasury / sovereign short-term instruments",
    "12": "ETF / fund-linked listed units / similar fund securities",
    "13": "Mutual fund units (older / legacy MF mapping is explicitly seen in NSDL circulars)",
    "14": "Alternative / special fund units or other unit-based securities",
    "15": "REIT / InvIT / trust-based listed units or similar pooled instruments",
    "16": "Security receipts / similar trust-backed instruments",
    "17": "Depository receipt / overseas-linked listed security type",
    "18": "Basel / perpetual / hybrid bank capital instruments",
    "19": "Market-linked / structured listed debt instruments",
    "20": "Other special-case unit / conversion mapping used in depository workflows",
}


def security_type_from_isin(isin: str | None) -> str | None:
    """Derive security type from ISIN characters 8–9. Returns None when ISIN is missing/too short."""
    if not isin:
        return None
    code = isin.strip().upper()
    if len(code) < 9:
        return None
    return ISIN_SECURITY_TYPES.get(code[7:9])
