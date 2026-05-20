import * as XLSX from "xlsx";

export type ShareCapitalExcelRow = {
  rtaCode: string;
  isin: string;
  companyName: string;
  addressLine1: string;
  addressLine2: string;
  addressLine3: string;
  state: string;
  securityType: string;
  nsdlShares: number;
  cdslShares: number;
  physicalShares: number;
  totalShares: number;
  dematConfirmedRequests: string;
  dematConfirmedShares: string;
  dematPendingRequests: string;
  dematPendingShares: string;
  email: string;
};

const COLUMN_ALIASES: Record<keyof ShareCapitalExcelRow, string[]> = {
  rtaCode: ["rta code", "rtacode", "rta"],
  isin: ["isin", "isin number", "isin no"],
  companyName: ["company name", "company"],
  addressLine1: ["address line 1", "address 1", "address line1"],
  addressLine2: ["address line 2", "address 2", "address line2"],
  addressLine3: ["address line 3", "address 3", "address line3"],
  state: ["state", "city pin", "city/state", "city pin state", "city, pin, state"],
  securityType: ["security type", "security"],
  nsdlShares: ["nsdl shares", "nsdl"],
  cdslShares: ["cdsl shares", "cdsl"],
  physicalShares: ["physical shares", "physical"],
  totalShares: ["total shares", "total"],
  dematConfirmedRequests: [
    "demat confirmed requests",
    "confirmed after 21 days requests",
    "demat confirmed requests (21 days)",
  ],
  dematConfirmedShares: [
    "demat confirmed shares",
    "confirmed after 21 days shares",
    "demat confirmed shares (21 days)",
  ],
  dematPendingRequests: [
    "demat pending requests",
    "pending more than 21 days requests",
    "demat pending requests (21 days)",
  ],
  dematPendingShares: [
    "demat pending shares",
    "pending more than 21 days shares",
    "demat pending shares (21 days)",
  ],
  email: ["email", "email id", "e-mail"],
};

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, " ");
}

function cellToString(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function cellToNumber(value: unknown): number {
  if (value == null || value === "") return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function mapHeaders(headerRow: string[]): Partial<Record<keyof ShareCapitalExcelRow, number>> {
  const map: Partial<Record<keyof ShareCapitalExcelRow, number>> = {};
  const normalized = headerRow.map(normalizeHeader);

  for (const key of Object.keys(COLUMN_ALIASES) as (keyof ShareCapitalExcelRow)[]) {
    const aliases = COLUMN_ALIASES[key];
    const idx = normalized.findIndex((h) => aliases.includes(h));
    if (idx >= 0) map[key] = idx;
  }
  return map;
}

export function parseShareCapitalExcel(buffer: ArrayBuffer): ShareCapitalExcelRow[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("Excel file has no sheets.");

  const sheet = workbook.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" }) as unknown[][];
  if (raw.length < 2) throw new Error("Excel file must have a header row and at least one data row.");

  const headerRow = raw[0].map((c) => cellToString(c));
  const colMap = mapHeaders(headerRow);

  const required: (keyof ShareCapitalExcelRow)[] = [
    "rtaCode",
    "isin",
    "companyName",
    "addressLine1",
    "state",
    "securityType",
    "nsdlShares",
    "cdslShares",
    "physicalShares",
  ];
  const missing = required.filter((k) => colMap[k] === undefined);
  if (missing.length > 0) {
    throw new Error(
      `Missing required column(s): ${missing.join(", ")}. Download the sample template for correct headers.`
    );
  }

  const rows: ShareCapitalExcelRow[] = [];

  for (let r = 1; r < raw.length; r++) {
    const row = raw[r];
    if (!row || row.every((c) => cellToString(c) === "")) continue;

    const get = (key: keyof ShareCapitalExcelRow) => {
      const idx = colMap[key];
      if (idx === undefined) return "";
      return cellToString(row[idx]);
    };
    const getNum = (key: keyof ShareCapitalExcelRow) => {
      const idx = colMap[key];
      if (idx === undefined) return 0;
      return cellToNumber(row[idx]);
    };

    const parsed: ShareCapitalExcelRow = {
      rtaCode: get("rtaCode"),
      isin: get("isin"),
      companyName: get("companyName"),
      addressLine1: get("addressLine1"),
      addressLine2: get("addressLine2"),
      addressLine3: get("addressLine3"),
      state: get("state"),
      securityType: get("securityType"),
      nsdlShares: getNum("nsdlShares"),
      cdslShares: getNum("cdslShares"),
      physicalShares: getNum("physicalShares"),
      totalShares: getNum("totalShares"),
      dematConfirmedRequests: get("dematConfirmedRequests") || "Zero",
      dematConfirmedShares: get("dematConfirmedShares") || "Zero",
      dematPendingRequests: get("dematPendingRequests") || "Zero",
      dematPendingShares: get("dematPendingShares") || "Zero",
      email: get("email"),
    };

    if (!parsed.rtaCode || !parsed.companyName) {
      throw new Error(`Row ${r + 1}: RTA Code and Company Name are required.`);
    }

    if (!parsed.totalShares) {
      parsed.totalShares = parsed.nsdlShares + parsed.cdslShares + parsed.physicalShares;
    }

    rows.push(parsed);
  }

  if (rows.length === 0) throw new Error("No data rows found in the Excel file.");
  return rows;
}

export function formatLetterDate(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

export function buildReferenceNo(prefix: string, rtaCode: string): string {
  const trimmedPrefix = prefix.trim();
  const trimmedRta = rtaCode.trim();
  if (!trimmedPrefix) return trimmedRta;
  if (trimmedPrefix.endsWith("/") || trimmedPrefix.endsWith("-")) {
    return `${trimmedPrefix}${trimmedRta}`;
  }
  return `${trimmedPrefix}/${trimmedRta}`;
}
