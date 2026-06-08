export const ISIN_SECURITY_TYPES: Record<number, string> = {
  1:  "Equity Shares",
  2:  "Non-Voting Equity Shares",
  3:  "Convertible Preference Shares",
  4:  "Non-Convertible Preference Shares",
  5:  "Mutual Fund Units (Close-Ended)",
  6:  "Mutual Fund Units (Open-Ended)",
  7:  "Secured Debentures",
  8:  "Unsecured Debentures",
  9:  "Regular Return Bonds / Promissory Notes",
  10: "Floating Rate Bonds",
  11: "Deep Discount Bonds",
  12: "Step Discount Bonds",
  13: "Warrants",
};

/**
 * Derives security type from ISIN code.
 * Positions 8-9 (1-indexed) encode the type number.
 */
export function securityTypeFromISIN(isin: string): string | null {
  if (!isin || isin.length < 9) return null;
  const code = parseInt(isin.slice(7, 9), 10);
  if (isNaN(code) || code < 1 || code > 13) return null;
  return ISIN_SECURITY_TYPES[code] ?? null;
}
