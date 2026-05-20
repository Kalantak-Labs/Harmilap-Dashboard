export type UserType = "ADMIN" | "EMPLOYEE" | "COMPANY" | "SHAREHOLDER";
export type PrimaryDepository = "NSDL" | "CDSL" | "BOTH";
export type SecurityType = "EQUITY" | "PREFERENCE" | "DEBT";
export type DepositoryType = "NSDL" | "CDSL" | "PHYSICAL";
export type InvoiceStatus = "DRAFT" | "ISSUED" | "PENDING" | "PAID" | "OVERDUE";
export type RequestStatus = "PENDING" | "REJECTED" | "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CLOSED";
export type RequestType =
  | "RTA_PROPOSAL"
  | "NEW_COMPANY_DRAFT"
  | "CHANGE_BILLING_GST"
  | "CHANGE_EMAIL_CONTACT"
  | "CHANGE_AUTH_SIGNATORY"
  | "NSDL_INVOICE_REQUEST"
  | "ISIN_ACTIVATION"
  | "RIGHT_ISSUE"
  | "BUYBACK"
  | "DEBENTURE_ADMISSION";
export type DownloadFormat = "PDF" | "EXCEL" | "WORD";

export type Company = {
  id: string;
  cin: string;
  name: string;
  rtaCode: string | null;
  primaryDepository: PrimaryDepository;
  dateOfIncorporation: Date;
  pan: string | null;
  tan: string | null;
  gst: string | null;
  regAddress: string | null;
  billingAddress: string | null;
  contactNumber1: string | null;
  contactNumber2: string | null;
  emailId1: string | null;
  emailId2: string | null;
  authPersonName: string | null;
  authPersonContact: string | null;
  accountsPersonName: string | null;
  accountsContact: string | null;
  companySecretary: string | null;
  csContact: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type Security = {
  id: string;
  isin: string;
  companyId: string;
  type: SecurityType;
  class: string;
  faceValue: number;
  isFullyPaid: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type Shareholder = {
  id: string;
  pan: string;
  primaryName: string;
  jointName: string | null;
  jointPan: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type BeneficiaryPosition = {
  id: string;
  securityId: string;
  shareholderId: string;
  depository: DepositoryType;
  dpId: string | null;
  clientId: string | null;
  folio: string | null;
  sharesCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type BeneficiaryPositionWithRelations = BeneficiaryPosition & {
  shareholder: Shareholder;
  security: Security & { company: Company };
};

export type CorporateAction = {
  id: string;
  securityId: string;
  allotmentDate: Date;
  nsdlHolders: number;
  cdslHolders: number;
  physicalHolders: number;
  faceValue: number;
  premium: number;
  paidUpValue: number;
  totalShares: number;
  totalHolders: number;
  totalValue: number;
  stampDuty: number;
  executionDate: Date | null;
  bankDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CorporateActionWithRelations = CorporateAction & {
  security: Security & { company: Company };
};

export type InvoiceLineItem = {
  id: string;
  invoiceId: string;
  code: string;
  description: string;
  amount: number;
  isTaxable: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type Invoice = {
  id: string;
  invoiceNo: string;
  companyId: string;
  date: Date;
  dueDate: Date | null;
  totalAmount: number;
  gstRate: number;
  gstAmount: number;
  totalAmountInclGst: number;
  status: InvoiceStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type InvoiceWithRelations = Invoice & {
  company: Company;
  lineItems: InvoiceLineItem[];
};

export type CapitalClass = {
  id: string;
  companyId: string;
  securityType: SecurityType;
  className: string;
  faceValue: number;
  numberOfShares: number;
  distinctiveNumberFrom: bigint;
  distinctiveNumberTo: bigint;
  createdAt: Date;
  updatedAt: Date;
};

export type CapitalClassWithCompany = CapitalClass & {
  company: Company;
};

export type Role = {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type User = {
  id: string;
  username: string;
  type: UserType;
  roleId: string | null;
  companyId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type UserWithRelations = User & {
  role: Role | null;
  company: Company | null;
};

export type OnlineRequest = {
  id: string;
  companyId: string;
  type: RequestType;
  title: string;
  details: string | null;
  requestedBy: string;
  status: RequestStatus;
  preferredFormat: DownloadFormat | null;
  createdAt: Date;
  updatedAt: Date;
};

export type OnlineRequestWithCompany = OnlineRequest & {
  company: Company;
};
