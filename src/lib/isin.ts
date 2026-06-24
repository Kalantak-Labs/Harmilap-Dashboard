/** ISIN security type — keyed by "<issuer prefix>:<security code>" (chars 1-3 + chars 8-9).
 * The same code maps differently by prefix (e.g. "01" is Equity for INE/IN9 but a
 * Mutual Fund Unit for INF), so both parts are required. */
export const ISIN_SECURITY_TYPES: Record<string, string> = {
  "INE:01": "Equity Share",
  "IN9:01": "Equity Share",
  "INF:01": "Mutual Fund Unit",
  "INE:02": "Postal Savings Scheme",
  "INE:03": "Preference Share",
  "IN9:03": "Preference Share",
  "INE:04": "Preference Share",
  "IN9:04": "Preference Share",
  "INE:05": "Deep Discount Bond",
  "INE:06": "Floating Rate Bond",
  "INE:07": "Bond / Debenture",
  "INE:08": "Bond / Debenture",
  "INE:09": "Bond / Debenture",
  "INE:10": "Floating Rate Bond",
  "INE:11": "Bonds",
  "INE:13": "Warrants",
  "INE:14": "Commercial Paper",
  "INE:15": "Securitised Instrument",
  "INE:16": "Certificate of Deposit",
  "INE:18": "Securitised Instrument",
  "IN9:19": "Mutual Fund Unit",
  "INF:19": "Mutual Fund Unit",
  "INF:1A": "Mutual Fund Unit",
  "INE:20": "Rights Entitlement",
  "INE:21": "Indian Depository Receipt",
  "INF:22": "Alternate Investment Fund",
  "INE:23": "Infrastructure Investment Trust",
  "INE:24": "Municipal Bond",
  "INE:25": "Real Estate Investment Trusts",
  "INF:A1": "Mutual Fund Unit",
  "INE:A7": "Debenture",
  "INF:B1": "Mutual Fund Unit",
  "INE:B7": "Debenture",
  "INF:C1": "Mutual Fund Unit",
};

/** Derives security type from ISIN prefix (chars 1-3) + security code (chars 8-9). */
export function securityTypeFromISIN(isin: string): string | null {
  if (!isin || isin.length < 9) return null;
  const u = isin.toUpperCase();
  return ISIN_SECURITY_TYPES[`${u.slice(0, 3)}:${u.slice(7, 9)}`] ?? null;
}
