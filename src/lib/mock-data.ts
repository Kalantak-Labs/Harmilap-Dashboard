import type {
  BeneficiaryPositionWithRelations,
  CapitalClassWithCompany,
  Company,
  CorporateActionWithRelations,
  InvoiceWithRelations,
  OnlineRequestWithCompany,
  Role,
  Security,
  SecurityType,
  UserWithRelations,
} from "./types";

const now = new Date("2025-01-15");

export const companies: Company[] = [
  {
    id: "comp-1",
    cin: "L12345DL2025PLC000001",
    name: "Dummy RTA Client Ltd",
    rtaCode: "RTA001",
    primaryDepository: "BOTH",
    dateOfIncorporation: new Date("2020-01-01"),
    pan: "ABCDE1234F",
    tan: "DELA12345A",
    gst: "07ABCDE1234F1Z5",
    regAddress: "123 Dummy Street, New Delhi",
    billingAddress: "123 Dummy Street, New Delhi",
    contactNumber1: "9876543210",
    contactNumber2: null,
    emailId1: "client@dummyrta.com",
    emailId2: null,
    authPersonName: "John Doe",
    authPersonContact: "9876543210",
    accountsPersonName: "Jane Accounts",
    accountsContact: "9876543211",
    companySecretary: "CS Officer",
    csContact: "9876543212",
    createdAt: now,
    updatedAt: now,
  },
];

export const securities: Security[] = [
  {
    id: "sec-eq-1",
    isin: "INE000A01010",
    companyId: "comp-1",
    type: "EQUITY",
    class: "Class A",
    faceValue: 10,
    isFullyPaid: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "sec-eq-2",
    isin: "IN9000A01020",
    companyId: "comp-1",
    type: "EQUITY",
    class: "Class B",
    faceValue: 10,
    isFullyPaid: false,
    createdAt: now,
    updatedAt: now,
  },
];

export const shareholders = [
  {
    id: "sh-1",
    pan: "SHRLD1234A",
    primaryName: "Alice Shareholder",
    jointName: null,
    jointPan: null,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "sh-2",
    pan: "SHRLD5678B",
    primaryName: "Bob Investor",
    jointName: null,
    jointPan: null,
    createdAt: now,
    updatedAt: now,
  },
];

export const beneficiaryPositions: BeneficiaryPositionWithRelations[] = [
  {
    id: "pos-1",
    securityId: "sec-eq-1",
    shareholderId: "sh-1",
    depository: "NSDL",
    dpId: "IN300000",
    clientId: "10000001",
    folio: null,
    sharesCount: 6000,
    createdAt: now,
    updatedAt: now,
    shareholder: shareholders[0],
    security: { ...securities[0], company: companies[0] },
  },
  {
    id: "pos-2",
    securityId: "sec-eq-1",
    shareholderId: "sh-2",
    depository: "CDSL",
    dpId: "12000000",
    clientId: "20000002",
    folio: null,
    sharesCount: 4000,
    createdAt: now,
    updatedAt: now,
    shareholder: shareholders[1],
    security: { ...securities[0], company: companies[0] },
  },
  {
    id: "pos-3",
    securityId: "sec-eq-2",
    shareholderId: "sh-1",
    depository: "PHYSICAL",
    dpId: null,
    clientId: null,
    folio: "FOL001",
    sharesCount: 2000,
    createdAt: now,
    updatedAt: now,
    shareholder: shareholders[0],
    security: { ...securities[1], company: companies[0] },
  },
];

export const corporateActions: CorporateActionWithRelations[] = [
  {
    id: "ca-1",
    securityId: "sec-eq-1",
    allotmentDate: new Date("2024-06-01"),
    nsdlHolders: 1,
    cdslHolders: 1,
    physicalHolders: 0,
    faceValue: 10,
    premium: 0,
    paidUpValue: 10,
    totalShares: 10000,
    totalHolders: 2,
    totalValue: 100000,
    stampDuty: 500,
    executionDate: new Date("2024-06-15"),
    bankDate: new Date("2024-06-20"),
    createdAt: now,
    updatedAt: now,
    security: { ...securities[0], company: companies[0] },
  },
];

export const invoices: InvoiceWithRelations[] = [
  {
    id: "inv-1",
    invoiceNo: "INV-2025-001",
    companyId: "comp-1",
    date: new Date("2025-01-01"),
    dueDate: new Date("2025-01-31"),
    totalAmount: 50000,
    gstRate: 18,
    gstAmount: 9000,
    totalAmountInclGst: 59000,
    status: "PENDING",
    createdAt: now,
    updatedAt: now,
    company: companies[0],
    lineItems: [
      {
        id: "li-1",
        invoiceId: "inv-1",
        code: "01",
        description: "RTA Annual Maintenance Fee",
        amount: 50000,
        isTaxable: true,
        createdAt: now,
        updatedAt: now,
      },
    ],
  },
];

export const capitalClasses: CapitalClassWithCompany[] = [
  {
    id: "cc-1",
    companyId: "comp-1",
    securityType: "EQUITY",
    className: "Class A",
    faceValue: 10,
    numberOfShares: 10000,
    distinctiveNumberFrom: BigInt(1),
    distinctiveNumberTo: BigInt(10000),
    createdAt: now,
    updatedAt: now,
    company: companies[0],
  },
];

export const roles: Role[] = [
  {
    id: "role-1",
    name: "Admin",
    description: "Master Control - Full Access",
    createdAt: now,
    updatedAt: now,
  },
];

export const users: UserWithRelations[] = [
  {
    id: "user-1",
    username: "admin",
    type: "ADMIN",
    roleId: "role-1",
    companyId: null,
    createdAt: now,
    updatedAt: now,
    role: roles[0],
    company: null,
  },
];

export const onlineRequests: OnlineRequestWithCompany[] = [
  {
    id: "req-1",
    companyId: "comp-1",
    type: "ISIN_ACTIVATION",
    title: "Activate new equity ISIN",
    details: "Requesting ISIN activation for Class C shares.",
    requestedBy: "John Doe",
    status: "OPEN",
    preferredFormat: "PDF",
    createdAt: now,
    updatedAt: now,
    company: companies[0],
  },
];

export function getCompanyById(id: string): Company | undefined {
  return companies.find((c) => c.id === id);
}

export function getSecuritiesWithCompany() {
  return securities.map((s) => ({
    ...s,
    company: companies.find((c) => c.id === s.companyId)!,
  }));
}

export function filterCompanies(params: {
  q?: string;
  f_cin?: string;
  f_name?: string;
  f_pan?: string;
  f_gst?: string;
}): Company[] {
  let result = [...companies];
  const { q, f_cin, f_name, f_pan, f_gst } = params;
  if (f_cin) result = result.filter((c) => c.cin === f_cin);
  if (f_name) result = result.filter((c) => c.name === f_name);
  if (f_pan) result = result.filter((c) => c.pan === f_pan);
  if (f_gst) result = result.filter((c) => c.gst === f_gst);
  if (q) {
    const lower = q.toLowerCase();
    result = result.filter(
      (c) =>
        c.name.toLowerCase().includes(lower) ||
        c.cin.toLowerCase().includes(lower)
    );
  }
  return result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export function filterPositions(
  securityType: SecurityType,
  params: {
    q?: string;
    filter?: string;
    f_company?: string;
    f_class?: string;
    f_holder?: string;
    f_pan?: string;
    f_depository?: string;
  }
): BeneficiaryPositionWithRelations[] {
  let result = beneficiaryPositions.filter((p) => p.security.type === securityType);
  const { q, filter, f_company, f_class, f_holder, f_pan, f_depository } = params;
  if (filter) result = result.filter((p) => p.security.companyId === filter);
  if (f_company) result = result.filter((p) => p.security.company.name === f_company);
  if (f_class) result = result.filter((p) => p.security.class === f_class);
  if (f_holder) result = result.filter((p) => p.shareholder.primaryName === f_holder);
  if (f_pan) result = result.filter((p) => p.shareholder.pan === f_pan);
  if (f_depository) result = result.filter((p) => p.depository === f_depository);
  if (q) {
    const lower = q.toLowerCase();
    result = result.filter(
      (p) =>
        p.shareholder.primaryName.toLowerCase().includes(lower) ||
        p.shareholder.pan.toLowerCase().includes(lower) ||
        (p.folio?.toLowerCase().includes(lower) ?? false) ||
        (p.clientId?.toLowerCase().includes(lower) ?? false)
    );
  }
  return result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export function filterInvoices(params: {
  q?: string;
  filter?: string;
  f_invoiceNo?: string;
  f_company?: string;
}): InvoiceWithRelations[] {
  let result = [...invoices];
  const { q, filter, f_invoiceNo, f_company } = params;
  if (filter) result = result.filter((i) => i.companyId === filter);
  if (f_invoiceNo) result = result.filter((i) => i.invoiceNo === f_invoiceNo);
  if (f_company) result = result.filter((i) => i.company.name === f_company);
  if (q) {
    const lower = q.toLowerCase();
    result = result.filter((i) => i.invoiceNo.toLowerCase().includes(lower));
  }
  return result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export function filterCorporateActions(params: {
  q?: string;
  filter?: string;
  f_company?: string;
  f_isin?: string;
}): CorporateActionWithRelations[] {
  let result = [...corporateActions];
  const { q, filter, f_company, f_isin } = params;
  if (filter) result = result.filter((a) => a.security.companyId === filter);
  if (f_company) result = result.filter((a) => a.security.company.name === f_company);
  if (f_isin) result = result.filter((a) => a.security.isin === f_isin);
  if (q) {
    const lower = q.toLowerCase();
    result = result.filter((a) => a.security.isin.toLowerCase().includes(lower));
  }
  return result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export function filterUsers(params: {
  q?: string;
  filter?: string;
  f_username?: string;
  f_type?: string;
  f_company?: string;
}): UserWithRelations[] {
  let result = [...users];
  const { q, filter, f_username, f_type, f_company } = params;
  if (filter) result = result.filter((u) => u.roleId === filter);
  if (f_username) result = result.filter((u) => u.username === f_username);
  if (f_type) result = result.filter((u) => u.type === f_type);
  if (f_company) result = result.filter((u) => u.company?.name === f_company);
  if (q) {
    const lower = q.toLowerCase();
    result = result.filter((u) => u.username.toLowerCase().includes(lower));
  }
  return result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export const dashboardStats = {
  totalCompanies: companies.length,
  totalHolders: shareholders.length,
  totalActions: corporateActions.length,
  activeInvoices: invoices.length,
  newCompaniesThisMonth: 1,
  recentCompanies: companies.slice(0, 2).map((c) => ({ id: c.id, cin: c.cin, name: c.name })),
  recentActions: corporateActions.slice(0, 2),
};

export function sumSharesByType(type: SecurityType): number {
  return beneficiaryPositions
    .filter((p) => p.security.type === type)
    .reduce((sum, p) => sum + p.sharesCount, 0);
}
