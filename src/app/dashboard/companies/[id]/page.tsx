"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Edit2, Trash2, Check, X } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/Toast";
import ConfirmModal from "@/components/ui/ConfirmModal";
import ArrayFieldEditor from "@/components/ui/ArrayFieldEditor";
import type { Company } from "@/lib/types";
import { securityTypeFromISIN } from "@/lib/isin";
import { INDIAN_STATES_UTS } from "@/lib/constants";

type EditState = Partial<Company> & {
  face_value?: string | number | null;
  total_shares?: string | number | null;
  nsdl_shares?: string | number | null;
  cdsl_shares?: string | number | null;
  physical_shares?: string | number | null;
};

const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <>
    <div className="detail-label">{label}</div>
    <div className="detail-value">{value ?? <span style={{ color: "var(--text-muted)" }}>—</span>}</div>
  </>
);

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { can } = useAuth();
  const { push } = useToast();

  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<EditState>({});
  const [saving, setSaving] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteStats, setDeleteStats] = useState<{ beneficiary_count: number; invoice_count: number } | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const load = async () => {
    try {
      const c = await api.companies.get(id);
      setCompany(c);
      setForm(c);
    } catch {
      push("error", "Company not found");
      router.push("/dashboard/companies");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    const nsdl = (form.nsdl_rta_code ?? "").toString();
    if (nsdl.trim() && !/RTAN/i.test(nsdl)) { push("error", "NSDL RTA Code must contain \"RTAN\""); return; }
    if (form.face_value != null && String(form.face_value) !== "" && Number(form.face_value) % 10 !== 0) { push("error", "Face value must be a multiple of 10"); return; }
    setSaving(true);
    try {
      const updated = await api.companies.update(id, {
        ...form,
        face_value: form.face_value != null && String(form.face_value) !== "" ? Number(form.face_value) : null,
        total_shares: form.total_shares != null && String(form.total_shares) !== "" ? Number(form.total_shares) : null,
        nsdl_shares: form.nsdl_shares != null && String(form.nsdl_shares) !== "" ? Number(form.nsdl_shares) : null,
        cdsl_shares: form.cdsl_shares != null && String(form.cdsl_shares) !== "" ? Number(form.cdsl_shares) : null,
        physical_shares: form.physical_shares != null && String(form.physical_shares) !== "" ? Number(form.physical_shares) : null,
      });
      setCompany(updated);
      setForm(updated);
      setEditing(false);
      push("success", "Company updated");
    } catch (err: unknown) {
      push("error", err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const deleteCompany = async () => {
    setDeleting(true);
    try {
      await api.companies.delete(id);
      push("success", "Company deleted");
      router.push("/dashboard/companies");
    } catch (err: unknown) {
      push("error", err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteClick = async () => {
    setLoadingStats(true);
    try {
      const stats = await api.companies.stats(id);
      setDeleteStats(stats);
    } catch {
      setDeleteStats(null);
    } finally {
      setLoadingStats(false);
      setShowDelete(true);
    }
  };

  const startEditing = () => {
    // If security_type is missing, auto-derive from ISIN
    const detected = company!.isin_code ? securityTypeFromISIN(company!.isin_code) : null;
    setForm({
      ...company!,
      ...(detected && !company!.security_type ? { security_type: detected } : {}),
    });
    setEditing(true);
  };

  const cancelEdit = () => { setForm(company!); setEditing(false); };

  if (loading) return <div className="spinner-center"><span className="spinner spinner-lg" /></div>;
  if (!company) return null;

  const inp = (field: keyof EditState, type = "text") => (
    <input
      className="input input-sm"
      type={type}
      value={(form[field] as string) ?? ""}
      onChange={(e) => set(field, e.target.value)}
    />
  );

  const ta = (field: keyof EditState) => (
    <textarea className="input input-sm" rows={2} value={(form[field] as string) ?? ""} onChange={(e) => set(field, e.target.value)} />
  );

  const chk = (field: keyof EditState) => (
    <input type="checkbox" checked={!!(form[field])} onChange={(e) => set(field, e.target.checked)} style={{ width: 16, height: 16, accentColor: "var(--accent)" }} />
  );

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => router.push("/dashboard/companies")}>
            <ArrowLeft size={16} />
          </button>
          <div>
            <h2>{company.company_name ?? company.isin_code ?? company.arn_number}</h2>
            <div style={{ color: "var(--text-secondary)", fontSize: 12, marginTop: 1 }}>
              {company.isin_code ? `ISIN: ${company.isin_code}` : `ARN: ${company.arn_number}`}
              {company.isin_code && company.arn_number && ` · ARN: ${company.arn_number}`}
              {company.nsdl_rta_code && ` · NSDL RTA: ${company.nsdl_rta_code}`}
              {company.cdsl_rta_code && ` · CDSL RTA: ${company.cdsl_rta_code}`}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {editing ? (
            <>
              <button className="btn btn-secondary" onClick={cancelEdit} disabled={saving}><X size={14} /> Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? <span className="spinner" /> : <Check size={14} />}
                Save
              </button>
            </>
          ) : (
            <>
              {can("editor") && (
                <button className="btn btn-secondary" onClick={startEditing}><Edit2 size={14} /> Edit</button>
              )}
              {can("editor") && (
                <button className="btn btn-danger" onClick={handleDeleteClick} disabled={loadingStats}>
                  {loadingStats ? <span className="spinner" /> : <Trash2 size={14} />} Delete
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        {/* Section: Core */}
        <div className="detail-grid">
          <div className="detail-section-title">Core Information</div>
          <Field label="ISIN Code" value={editing
            ? inp("isin_code")
            : company.isin_code
              ? <code style={{ fontSize: 13, background: "var(--bg)", padding: "2px 6px", borderRadius: 4 }}>{company.isin_code}</code>
              : null}
          />
          <Field label="ARN Number" value={editing
            ? inp("arn_number")
            : company.arn_number
              ? <code style={{ fontSize: 13, background: "var(--bg)", padding: "2px 6px", borderRadius: 4 }}>{company.arn_number}</code>
              : null}
          />
          <Field label="Company Name" value={editing ? inp("company_name") : company.company_name} />
          <Field label="NSDL RTA Code" value={editing ? inp("nsdl_rta_code") : company.nsdl_rta_code} />
          <Field label="CDSL RTA Code" value={editing ? inp("cdsl_rta_code") : company.cdsl_rta_code} />
          <Field label="Security Type" value={editing ? inp("security_type") : company.security_type ? <span className="badge badge-gray">{company.security_type}</span> : null} />
          <Field label="Face Value" value={editing ? inp("face_value", "number") : company.face_value != null ? `₹${company.face_value}` : null} />
        </div>

        {/* Section: Contact */}
        <div className="detail-grid" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="detail-section-title">Contact</div>
          <Field label="Email IDs" value={editing
            ? <ArrayFieldEditor values={(form.email_ids as string[]) ?? []} onChange={(v) => set("email_ids", v)} placeholder="email@example.com" inputType="email" />
            : company.email_ids?.length
              ? <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>{company.email_ids.map((e, i) => <span key={i}>{e}</span>)}</div>
              : null}
          />
          <Field label="Contact Numbers" value={editing
            ? <ArrayFieldEditor values={(form.contact_numbers as string[]) ?? []} onChange={(v) => set("contact_numbers", v)} placeholder="+91 XXXXX XXXXX" inputType="tel" />
            : company.contact_numbers?.length
              ? <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>{company.contact_numbers.map((n, i) => <span key={i}>{n}</span>)}</div>
              : null}
          />
          <Field label="Authorized Person" value={editing ? inp("authorized_person_name") : company.authorized_person_name} />
          <Field label="Designation" value={editing ? inp("authorized_person_designation") : company.authorized_person_designation} />
        </div>

        {/* Section: Tax & Legal */}
        <div className="detail-grid" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="detail-section-title">Tax & Legal</div>
          <Field label="GST Number" value={editing ? inp("gst_number") : company.gst_number} />
          <Field label="TAN Number" value={editing ? inp("tan_number") : company.tan_number} />
          <Field label="PAN Number" value={editing ? inp("pan_number") : company.pan_number} />
          <Field label="PAN Holder Type" value={company.pan_holder_type ? <span className="badge badge-gray">{company.pan_holder_type}</span> : null} />
        </div>

        {/* Section: Registered Address */}
        <div className="detail-grid" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="detail-section-title">Registered Address</div>
          <Field label="Line 1" value={editing ? inp("reg_address_line1") : company.reg_address_line1} />
          <Field label="Line 2" value={editing ? inp("reg_address_line2") : company.reg_address_line2} />
          <Field label="Line 3" value={editing ? inp("reg_address_line3") : company.reg_address_line3} />
          <Field label="Line 4" value={editing ? inp("reg_address_line4") : company.reg_address_line4} />
          <Field label="City" value={editing ? inp("reg_city") : company.reg_city} />
          <Field label="State" value={editing ? (
            <select className="input input-sm" value={(form.state as string) ?? ""} onChange={(e) => set("state", e.target.value)}>
              <option value="">Select state / UT…</option>
              {INDIAN_STATES_UTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          ) : company.state} />
          <Field label="Pin Code" value={editing ? inp("reg_pin_code") : company.reg_pin_code} />
          <Field label="Complete Address" value={(() => {
            const s = editing ? form : company;
            const parts = [s.reg_address_line1, s.reg_address_line2, s.reg_address_line3, s.reg_address_line4, s.reg_city, s.state, s.reg_pin_code]
              .map((v) => (v == null ? "" : String(v).trim()))
              .filter(Boolean);
            return parts.length ? parts.join(", ") : null;
          })()} />
        </div>

        {/* Section: Billing Address */}
        <div className="detail-grid" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="detail-section-title">Billing Address</div>
          <div className="detail-label">Billing Address</div>
          <div className="detail-value" style={{ gridColumn: "span 1" }}>{editing ? ta("billing_address") : company.billing_address ?? <span style={{ color: "var(--text-muted)" }}>—</span>}</div>
        </div>

        {/* Section: Share Details */}
        <div className="detail-grid" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="detail-section-title">Share Details</div>
          <Field label="Total Shares" value={editing ? inp("total_shares", "number") : company.total_shares?.toLocaleString()} />
          <Field label="Physical Shares (auto)" value={editing
            ? <span style={{ color: "var(--text-muted)" }}>
                {(Number(form.total_shares || 0) - Number(form.nsdl_shares || 0) - Number(form.cdsl_shares || 0)).toLocaleString()}
                <span style={{ fontSize: 11, marginLeft: 6 }}>= Total − NSDL − CDSL</span>
              </span>
            : company.physical_shares?.toLocaleString()} />
          <Field label="Has NSDL Shares" value={editing
            ? chk("has_nsdl_shares")
            : company.has_nsdl_shares ? <span className="badge badge-green">Yes</span> : <span className="badge badge-gray">No</span>}
          />
          <Field label="NSDL Shares" value={editing && form.has_nsdl_shares
            ? inp("nsdl_shares", "number")
            : company.has_nsdl_shares ? company.nsdl_shares?.toLocaleString() : null}
          />
          <Field label="Has CDSL Shares" value={editing
            ? chk("has_cdsl_shares")
            : company.has_cdsl_shares ? <span className="badge badge-blue">Yes</span> : <span className="badge badge-gray">No</span>}
          />
          <Field label="CDSL Shares" value={editing && form.has_cdsl_shares
            ? inp("cdsl_shares", "number")
            : company.has_cdsl_shares ? company.cdsl_shares?.toLocaleString() : null}
          />
        </div>

        {/* Audit footer */}
        <div style={{ padding: "10px 14px", borderTop: "1px solid var(--border)", background: "var(--bg)", display: "flex", gap: 24, fontSize: 12, color: "var(--text-muted)" }}>
          <span>Created: {new Date(company.created_at).toLocaleString("en-IN")}</span>
          <span>Updated: {new Date(company.updated_at).toLocaleString("en-IN")}</span>
        </div>
      </div>

      {showDelete && (
        <ConfirmModal
          title="Delete Company"
          message={[
            `Are you sure you want to delete "${company.company_name ?? company.isin_code ?? company.arn_number}"?`,
            deleteStats && (deleteStats.beneficiary_count > 0 || deleteStats.invoice_count > 0)
              ? `This will permanently delete ${deleteStats.beneficiary_count} beneficiar${deleteStats.beneficiary_count === 1 ? "y" : "ies"} and ${deleteStats.invoice_count} invoice record${deleteStats.invoice_count === 1 ? "" : "s"}. `
              : "",
            "This cannot be undone.",
          ].join(" ").trim()}
          confirmLabel="Delete"
          danger
          loading={deleting}
          onConfirm={deleteCompany}
          onClose={() => { setShowDelete(false); setDeleteStats(null); }}
        />
      )}
    </div>
  );
}
