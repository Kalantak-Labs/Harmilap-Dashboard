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
  isin_code: string;
  company_name: string | null;
  rta_code: string | null;
  email_ids: string[];
  contact_numbers: string[];
  authorized_person_name: string | null;
  authorized_person_designation: string | null;
  gst_number: string | null;
  tan_number: string | null;
  pan_number: string | null;
  reg_address_line1: string | null;
  reg_address_line2: string | null;
  reg_address_line3: string | null;
  reg_address_line4: string | null;
  reg_city: string | null;
  reg_pin_code: string | null;
  billing_address: string | null;
  security_type: string | null;
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
  isin_code: string;
  company_name: string | null;
  rta_code: string | null;
  security_type: string | null;
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
