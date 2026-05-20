import {
  beneficiaryPositions,
  capitalClasses,
} from "./mock-data";

export function generateReconciliationData(asOnDate?: string) {
  const grouped = new Map<
    string,
    {
      company: string;
      isin: string;
      securityType: string;
      nsdl: number;
      cdsl: number;
      physical: number;
    }
  >();

  for (const p of beneficiaryPositions) {
    const key = `${p.security.companyId}::${p.security.isin}`;
    const existing = grouped.get(key) || {
      company: p.security.company.name,
      isin: p.security.isin,
      securityType: p.security.type,
      nsdl: 0,
      cdsl: 0,
      physical: 0,
    };
    if (p.depository === "NSDL") existing.nsdl += p.sharesCount;
    if (p.depository === "CDSL") existing.cdsl += p.sharesCount;
    if (p.depository === "PHYSICAL") existing.physical += p.sharesCount;
    grouped.set(key, existing);
  }

  return Array.from(grouped.values()).map((row, idx) => {
    const total = row.nsdl + row.cdsl + row.physical;
    return {
      Serial_No: idx + 1,
      As_On_Date: asOnDate || new Date().toISOString().slice(0, 10),
      Company: row.company,
      ISIN: row.isin,
      Security_Type: row.securityType,
      NSDL: row.nsdl,
      CDSL: row.cdsl,
      Physical: row.physical,
      Total_Shares: total,
      Difference: 0,
    };
  });
}

export function generateReconciliationSummary(asOnDate?: string) {
  const detailedRows = generateReconciliationData(asOnDate);
  const summaryMap = new Map<
    string,
    {
      company: string;
      nsdl: number;
      cdsl: number;
      physical: number;
      total: number;
      expected: number;
    }
  >();

  for (const row of detailedRows) {
    const existing = summaryMap.get(row.Company) || {
      company: row.Company,
      nsdl: 0,
      cdsl: 0,
      physical: 0,
      total: 0,
      expected: 0,
    };
    existing.nsdl += Number(row.NSDL);
    existing.cdsl += Number(row.CDSL);
    existing.physical += Number(row.Physical);
    existing.total += Number(row.Total_Shares);
    summaryMap.set(row.Company, existing);
  }

  for (const cls of capitalClasses) {
    const existing = summaryMap.get(cls.company.name) || {
      company: cls.company.name,
      nsdl: 0,
      cdsl: 0,
      physical: 0,
      total: 0,
      expected: 0,
    };
    existing.expected += cls.numberOfShares;
    summaryMap.set(cls.company.name, existing);
  }

  return Array.from(summaryMap.values()).map((row) => ({
    Company: row.company,
    NSDL: row.nsdl,
    CDSL: row.cdsl,
    Physical: row.physical,
    Total_Shares: row.total,
    Expected_Shares: row.expected,
    Difference: row.total - row.expected,
  }));
}

export function generateReconciliationComparison(baseDate: string, compareDate: string) {
  const [baseSummary, compareSummary] = [
    generateReconciliationSummary(baseDate),
    generateReconciliationSummary(compareDate),
  ];
  const compareMap = new Map(compareSummary.map((row) => [row.Company, row]));
  return baseSummary.map((row) => {
    const other = compareMap.get(row.Company);
    return {
      Company: row.Company,
      Base_Date: baseDate,
      Compare_Date: compareDate,
      Base_Total: row.Total_Shares,
      Compare_Total: other?.Total_Shares || 0,
      Change_In_Shares: (other?.Total_Shares || 0) - row.Total_Shares,
      Base_Difference: row.Difference,
      Compare_Difference: other?.Difference || 0,
    };
  });
}

export function generateBeneficiaryData(asOnDate?: string) {
  return beneficiaryPositions.map((p, idx) => ({
    Serial_No: idx + 1,
    As_On_Date: asOnDate || new Date().toISOString().slice(0, 10),
    Company: p.security.company.name,
    ISIN: p.security.isin,
    Security_Type: p.security.type,
    Holder_Name_1: p.shareholder.primaryName,
    PAN_1: p.shareholder.pan,
    Holder_Name_2: p.shareholder.jointName || "",
    PAN_2: p.shareholder.jointPan || "",
    Depository: p.depository,
    DP_ID: p.dpId || "",
    Client_ID: p.clientId || "",
    Folio: p.folio || "",
    Shares: p.sharesCount,
  }));
}
