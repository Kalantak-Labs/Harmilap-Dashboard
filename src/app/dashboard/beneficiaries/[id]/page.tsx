"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Users } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import type { Beneficiary } from "@/lib/types";

const BENEF_TYPE: Record<number, string> = {
  1: "Resident", 2: "FI", 3: "FII", 4: "NRI", 5: "Body Corporate",
  6: "CM", 7: "Foreign National", 8: "Mutual Fund", 9: "Trust", 10: "Bank", 11: "QFI",
};
const ACCT_CAT: Record<number, string> = { 1: "House", 2: "Non House", 3: "CM", 4: "CC" };
const ACCT_TYPE: Record<number, string> = { 1: "Savings", 2: "Current", 3: "NRE", 4: "NRO" };

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, color: value != null && value !== "" ? "var(--text)" : "var(--text-muted)", fontStyle: value != null && value !== "" ? "normal" : "italic" }}>
        {value != null && value !== "" ? value : "—"}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", fontWeight: 600, fontSize: 13, color: "var(--text-secondary)" }}>{title}</div>
      <div style={{ padding: "16px 18px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "0 24px" }}>
        {children}
      </div>
    </div>
  );
}

function NumField({ label, value, accent }: { label: string; value: number | null | undefined; accent?: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, fontVariantNumeric: "tabular-nums", color: value ? (accent ?? "var(--text)") : "var(--text-muted)", fontStyle: value ? "normal" : "italic" }}>
        {value != null ? value.toLocaleString() : "—"}
      </div>
    </div>
  );
}

export default function BeneficiaryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { push } = useToast();

  const [b, setB] = useState<Beneficiary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.beneficiaries.get(id)
      .then(setB)
      .catch((e: unknown) => push("error", e instanceof Error ? e.message : "Not found"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><span className="spinner" /></div>;
  if (!b) return (
    <div className="empty-state"><Users size={32} /><div>Beneficiary not found</div>
      <button className="btn btn-secondary btn-sm" onClick={() => router.back()}>Go back</button>
    </div>
  );

  const addr = [b.address_line1, b.address_line2, b.address_line3, b.address_line4].filter(Boolean).join(", ");

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => router.back()}><ArrowLeft size={16} /></button>
          <div>
            <h2 style={{ marginBottom: 2 }}>{b.first_holder_name ?? "Beneficiary"}</h2>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {b.isin_code} · {b.dp_id} / {b.client_id}
              {b.record_date && <> · Record date: {new Date(b.record_date).toLocaleDateString("en-IN")}</>}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {b.beneficiary_type && <span className="badge badge-gray">{BENEF_TYPE[b.beneficiary_type] ?? b.beneficiary_type}</span>}
          {b.account_category && <span className="badge badge-blue">{ACCT_CAT[b.account_category] ?? b.account_category}</span>}
        </div>
      </div>

      <Section title="Identification">
        <Field label="ISIN Code" value={b.isin_code} />
        <Field label="DP ID" value={b.dp_id} />
        <Field label="Client ID" value={b.client_id} />
        <Field label="Record Date" value={b.record_date ? new Date(b.record_date).toLocaleDateString("en-IN") : null} />
      </Section>

      <Section title="First Holder">
        <Field label="Name" value={b.first_holder_name} />
        <Field label="Father / Husband Name" value={b.first_holder_father_husband_name} />
        <Field label="PAN" value={b.first_holder_pan} />
        <Field label="Email" value={b.first_holder_email} />
        <Field label="MAPIN ID" value={b.first_holder_mapin_id} />
      </Section>

      {(b.second_holder_name || b.third_holder_name) && (
        <Section title="Other Holders">
          {b.second_holder_name && <>
            <Field label="Second Holder" value={b.second_holder_name} />
            <Field label="2nd PAN" value={b.second_holder_pan} />
            <Field label="2nd Email" value={b.second_holder_email} />
          </>}
          {b.third_holder_name && <>
            <Field label="Third Holder" value={b.third_holder_name} />
            <Field label="3rd PAN" value={b.third_holder_pan} />
            <Field label="3rd Email" value={b.third_holder_email} />
          </>}
        </Section>
      )}

      <Section title="Address">
        <div style={{ gridColumn: "1 / -1" }}>
          <Field label="Address" value={addr || null} />
        </div>
        <Field label="Pin Code" value={b.pin_code} />
        <Field label="Phone" value={b.phone} />
        <Field label="Fax" value={b.fax} />
      </Section>

      {(b.nominee_guardian_name || b.nominee_guardian_indicator) && (
        <Section title="Nominee / Guardian">
          <Field label="Indicator" value={b.nominee_guardian_indicator} />
          <Field label="Name" value={b.nominee_guardian_name} />
          <Field label="Address Line 1" value={b.nominee_address_line1} />
          <Field label="Address Line 2" value={b.nominee_address_line2} />
          <Field label="Pin Code" value={b.nominee_pin_code} />
          <Field label="Minor" value={b.minor_indicator} />
          <Field label="Date of Birth" value={b.dob_minor ? new Date(b.dob_minor).toLocaleDateString("en-IN") : null} />
        </Section>
      )}

      <Section title="Bank Details">
        <Field label="Account Number" value={b.bank_account_number} />
        <Field label="Name & Branch" value={b.bank_name_branch} />
        <Field label="Account Type" value={b.bank_account_type != null ? (ACCT_TYPE[b.bank_account_type] ?? String(b.bank_account_type)) : null} />
        <Field label="IFSC" value={b.ifsc} />
        <Field label="MICR Code" value={b.micr_code} />
        <Field label="Bank Address Line 1" value={b.bank_address_line1} />
        <Field label="Bank Address Line 2" value={b.bank_address_line2} />
        <Field label="Bank Pin Code" value={b.bank_pin_code} />
      </Section>

      {(b.rbi_reference_number || b.rbi_approval_date || b.sebi_registration_number) && (
        <Section title="NRI / Regulatory">
          <Field label="RBI Reference" value={b.rbi_reference_number} />
          <Field label="RBI Approval Date" value={b.rbi_approval_date ? new Date(b.rbi_approval_date).toLocaleDateString("en-IN") : null} />
          <Field label="SEBI Reg. No." value={b.sebi_registration_number} />
          <Field label="Tax Deduction Status" value={b.tax_deduction_status} />
          <Field label="RGESS Flag" value={b.rgess_flag} />
        </Section>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", fontWeight: 600, fontSize: 13, color: "var(--text-secondary)" }}>Positions</div>
        <div style={{ padding: "16px 18px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "0 24px" }}>
          <NumField label="Free" value={b.free_positions} />
          <NumField label="Lock-in" value={b.lockin_positions} accent="var(--warning)" />
          <NumField label="Block" value={b.block_positions} />
          <NumField label="Pledged" value={b.pledged_positions} accent="var(--danger)" />
          <NumField label="Pledged Lock-in" value={b.pledged_lockin_positions} accent="var(--danger)" />
          <NumField label="Unconf. Pledged" value={b.unconfirmed_pledged_positions} />
          <NumField label="Unconf. Pledged Lock-in" value={b.unconfirmed_pledged_lockin_positions} />
          <NumField label="Remat" value={b.remat_positions} />
          <NumField label="Remat Lock-in" value={b.remat_lockin_positions} />
          <NumField label="IDD" value={b.idd_positions} />
          <NumField label="CM Pool" value={b.cm_pool_positions} />
          <NumField label="CC Settlement" value={b.cc_settlement_positions} />
        </div>
      </div>

      <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "right", marginTop: 4 }}>
        Created: {new Date(b.created_at).toLocaleString("en-IN")}
        {b.updated_at && <> · Updated: {new Date(b.updated_at).toLocaleString("en-IN")}</>}
      </div>
    </div>
  );
}
