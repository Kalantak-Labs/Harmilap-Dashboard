export type Role = "admin" | "user";
export type Permission = "viewer" | "editor" | "can_ingest" | "can_download";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  permissions: Permission[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Company {
  id: string;
  isin_code: string | null;
  arn_number: string | null;
  company_name: string | null;
  nsdl_rta_code: string | null;
  cdsl_rta_code: string | null;
  email_ids: string[];
  contact_numbers: string[];
  authorized_person_name: string | null;
  authorized_person_designation: string | null;
  gst_number: string | null;
  tan_number: string | null;
  pan_number: string | null;
  pan_holder_type: string | null;
  reg_address_line1: string | null;
  reg_address_line2: string | null;
  reg_address_line3: string | null;
  reg_address_line4: string | null;
  reg_city: string | null;
  state: string | null;
  reg_pin_code: string | null;
  billing_address: string | null;
  security_type: string | null;
  face_value: number | null;
  total_shares: number | null;
  has_nsdl_shares: boolean;
  nsdl_shares: number | null;
  has_cdsl_shares: boolean;
  cdsl_shares: number | null;
  physical_shares: number | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface CompanyListItem {
  id: string;
  isin_code: string | null;
  arn_number: string | null;
  company_name: string | null;
  nsdl_rta_code: string | null;
  cdsl_rta_code: string | null;
  security_type: string | null;
  face_value: number | null;
  total_shares: number | null;
  has_nsdl_shares: boolean;
  has_cdsl_shares: boolean;
  updated_at: string;
}

export interface IngestResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export interface BeneficiaryListItem {
  id: string;
  isin_code: string;
  dp_id: string;
  client_id: string;
  depository: string;
  record_date: string | null;
  first_holder_name: string | null;
  first_holder_pan: string | null;
  beneficiary_type: number | null;
  account_category: number | null;
  free_positions: number | null;
  lockin_positions: number | null;
  block_positions: number | null;
  pledged_positions: number | null;
  ifsc: string | null;
  bank_account_type: number | null;
  updated_at: string;
}

export interface Beneficiary extends BeneficiaryListItem {
  beneficiary_sub_type: number | null;
  occupation: number | null;
  beneficiary_status: number | null;
  first_holder_father_husband_name: string | null;
  first_holder_email: string | null;
  first_holder_mapin_id: string | null;
  second_holder_name: string | null;
  second_holder_father_husband_name: string | null;
  second_holder_pan: string | null;
  second_holder_email: string | null;
  second_holder_mapin_id: string | null;
  third_holder_name: string | null;
  third_holder_father_husband_name: string | null;
  third_holder_pan: string | null;
  third_holder_email: string | null;
  third_holder_mapin_id: string | null;
  address_line1: string | null;
  address_line2: string | null;
  address_line3: string | null;
  address_line4: string | null;
  pin_code: string | null;
  phone: string | null;
  fax: string | null;
  nominee_guardian_indicator: string | null;
  nominee_guardian_name: string | null;
  nominee_address_line1: string | null;
  nominee_address_line2: string | null;
  nominee_address_line3: string | null;
  nominee_address_line4: string | null;
  nominee_pin_code: string | null;
  dob_minor: string | null;
  minor_indicator: string | null;
  bank_account_number: string | null;
  bank_name_branch: string | null;
  bank_address_line1: string | null;
  bank_address_line2: string | null;
  bank_address_line3: string | null;
  bank_address_line4: string | null;
  bank_pin_code: string | null;
  micr_code: string | null;
  rbi_reference_number: string | null;
  rbi_approval_date: string | null;
  sebi_registration_number: string | null;
  tax_deduction_status: string | null;
  pledged_lockin_positions: number | null;
  unconfirmed_pledged_positions: number | null;
  unconfirmed_pledged_lockin_positions: number | null;
  remat_positions: number | null;
  remat_lockin_positions: number | null;
  idd_positions: number | null;
  cm_pool_positions: number | null;
  cc_settlement_positions: number | null;
  rgess_flag: string | null;
  created_at: string;
}

export interface InvoiceLineItem {
  id: number;
  description: string;
  sac_code: string;
  amount: number;
  is_red: boolean;
  non_taxable: boolean;
  enabled: boolean;
}

export interface BankDetail {
  label: string;
  value: string;
}

export interface BankAccount {
  title: string;
  details: BankDetail[];
}

export interface InvoiceConfig {
  line_items: InvoiceLineItem[];
  gst_type: "IGST" | "CGST_SGST";
  igst_rate: number;
  cgst_rate: number;
  sgst_rate: number;
  invoice_date: string | null;
  bank_accounts: BankAccount[];
}

// Company-level tax invoices (keyed by RTA code)
export type Particular = InvoiceLineItem;

export interface PartyListItem {
  party_key: string;
  nsdl_rta_code: string | null;
  cdsl_rta_code: string | null;
  company_name: string | null;
  isin_count: number; // chargeable units — an ISIN in both NSDL & CDSL counts as 2
  isins: string[];
  invoice_no: string | null;
  grand_total: number;
  payment_status: boolean;
  payment_date: string | null;
  amount_paid: number | null;
  last_generated_at: string | null;
  has_record: boolean;
}

export interface Invoice {
  id: string | null;
  party_key: string;
  nsdl_rta_code: string | null;
  cdsl_rta_code: string | null;
  company_name: string | null;
  pan_number: string | null;
  gst_number: string | null;
  billing_address: string | null;
  isins: string[];
  isin_count: number; // chargeable units
  particulars: Particular[];
  gst_type: "IGST" | "CGST_SGST";
  igst_rate: number;
  cgst_rate: number;
  sgst_rate: number;
  invoice_no: string | null;
  invoice_date: string | null;
  default_invoice_no: string | null;
  fiscal_year: string | null;
  payment_status: boolean;
  payment_date: string | null;
  amount_paid: number | null;
  last_generated_at: string | null;
  grand_total: number;
}

export interface InvoiceUpdate {
  particulars?: Particular[];
  gst_type?: "IGST" | "CGST_SGST";
  igst_rate?: number;
  cgst_rate?: number;
  sgst_rate?: number;
  invoice_no?: string | null;
  invoice_date?: string | null;
  payment_status?: boolean;
  payment_date?: string | null;
  amount_paid?: number | null;
}

export interface InvoiceNoCheck {
  available: boolean;
  default_invoice_no: string | null;
}

export interface InvoiceArchive {
  id: string;
  invoice_no: string;
  invoice_date: string | null;
  fiscal_year: string;
  filename: string;
  grand_total: number | null;
  generated_at: string;
}

export interface ZipIngestResult {
  files_processed: number;
  files_skipped: number;
  total_created: number;
  total_updated: number;
  total_skipped: number;
  errors: string[];
  unknown_isins: string[];
  nsdl_updated: number;
  cdsl_updated: number;
}

export interface CompanyStats {
  beneficiary_count: number;
  invoice_count: number;
}

export interface EmailSettings {
  id: number;
  smtp_host: string | null;
  smtp_port: number;
  smtp_username: string | null;
  smtp_password: string | null;
  smtp_use_tls: boolean;
  sender_name: string | null;
  sender_email: string | null;
  is_configured: boolean;
}

export type EmailType = "invoice" | "benpos" | "reconciliation";

export interface EmailTemplate {
  id: string;
  email_type: EmailType;
  name: string;
  subject: string;
  body: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface TemplateVariable {
  key: string;
  label: string;
}

export interface SendResultItem {
  company_id: string;
  company_name: string | null;
  emails: string[];
  status: "sent" | "failed" | "no_email";
  error?: string;
}

export interface SendResponse {
  sent: number;
  failed: number;
  no_email: number;
  results: SendResultItem[];
}

export interface ActionLog {
  id: string;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  resource_label: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface ActionLogListResponse {
  items: ActionLog[];
  total: number;
}

export interface ActionLogFilters {
  actions: string[];
  resource_types: string[];
}

export interface PartyBillingItem {
  party_key: string;
  nsdl_rta_code: string | null;
  cdsl_rta_code: string | null;
  company_name: string | null;
  isin_count: number;
  isins: string[];
  total_billed: number;
  total_received: number;
  outstanding: number;
  invoice_count: number;
}

export interface PartyBillingListResponse {
  items: PartyBillingItem[];
  total: number;
}

export interface PartyBillingSettings {
  party_key: string;
  company_name: string | null;
  isin_count: number;
  particulars: Particular[];
  preview_total: number;
}

export interface BillingInvoiceRecord {
  id: string;
  invoice_no: string;
  invoice_date: string;
  fiscal_year: string;
  grand_total: number;
  filename: string;
  generated_at: string;
}

export interface BillingPaymentRecord {
  id: string;
  amount: number;
  receiving_bank: string;
  reference_number: string;
  received_at: string;
  created_at: string;
}

export interface PartyBillingSummary {
  party_key: string;
  company_name: string | null;
  nsdl_rta_code: string | null;
  cdsl_rta_code: string | null;
  isin_count: number;
  total_billed: number;
  total_received: number;
  outstanding: number;
  invoices: BillingInvoiceRecord[];
  payments: BillingPaymentRecord[];
}
