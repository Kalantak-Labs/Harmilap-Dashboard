/** ISIN digits 8–9 (1-indexed) → security type (NSDL depository classification). */
export const ISIN_SECURITY_TYPES: Record<string, string> = {
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
};

/** Derives security type from ISIN characters 8–9. Returns null when ISIN is missing or unmapped. */
export function securityTypeFromISIN(isin: string): string | null {
  if (!isin || isin.length < 9) return null;
  return ISIN_SECURITY_TYPES[isin.slice(7, 9).toUpperCase()] ?? null;
}
