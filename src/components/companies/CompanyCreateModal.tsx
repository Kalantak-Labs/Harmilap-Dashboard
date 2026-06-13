"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import ArrayFieldEditor from "@/components/ui/ArrayFieldEditor";
import { securityTypeFromISIN } from "@/lib/isin";

interface Props { onClose: () => void; onCreated: () => void; }

export default function CompanyCreateModal({ onClose, onCreated }: Props) {
  const { push } = useToast();
  const [loading, setLoading] = useState(false);
  const [secAutoFilled, setSecAutoFilled] = useState(false);
  const [form, setForm] = useState({
    isin_code: "", arn_number: "", company_name: "", nsdl_rta_code: "", cdsl_rta_code: "",
    email_ids: [] as string[], contact_numbers: [] as string[],
    authorized_person_name: "", authorized_person_designation: "",
    gst_number: "", tan_number: "", pan_number: "",
    reg_address_line1: "", reg_address_line2: "", reg_address_line3: "", reg_address_line4: "",
    reg_city: "", reg_pin_code: "", billing_address: "",
    security_type: "", face_value: "",
    total_shares: "", has_nsdl_shares: false, nsdl_shares: "",
    has_cdsl_shares: false, cdsl_shares: "", physical_shares: "",
  });

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const handleIsinChange = (isin: string) => {
    const detected = securityTypeFromISIN(isin);
    setForm((f) => ({
      ...f,
      isin_code: isin,
      // Auto-fill when field is empty or was previously auto-filled
      ...(detected !== null && (secAutoFilled || !f.security_type) ? { security_type: detected } : {}),
    }));
    if (detected !== null) setSecAutoFilled(true);
  };

  const handleSecurityTypeChange = (v: string) => {
    set("security_type", v);
    setSecAutoFilled(false);
  };

  const isinLen = form.isin_code.trim().length;
  const isinEntered = isinLen > 0;
  const hasArn = form.arn_number.trim().length > 0;
  const isinValid = isinLen === 12 && /^[A-Z0-9]{12}$/.test(form.isin_code.trim().toUpperCase());

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isinEntered && !hasArn) { push("error", "Enter an ISIN code or an ARN number"); return; }
    if (isinEntered && !isinValid) { push("error", "ISIN must be exactly 12 alphanumeric characters"); return; }
    setLoading(true);
    try {
      await api.companies.create({
        ...form,
        face_value: form.face_value ? Number(form.face_value) : null,
        total_shares: form.total_shares ? Number(form.total_shares) : null,
        nsdl_shares: form.nsdl_shares ? Number(form.nsdl_shares) : null,
        cdsl_shares: form.cdsl_shares ? Number(form.cdsl_shares) : null,
        physical_shares: form.physical_shares ? Number(form.physical_shares) : null,
      });
      push("success", "Company created");
      onCreated();
    } catch (err: unknown) {
      push("error", err instanceof Error ? err.message : "Failed to create");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add Company</h2>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            <div style={{ fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--text-muted)", marginBottom: 2 }}>Core</div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">ISIN Code</label>
                <input
                  className="input"
                  value={form.isin_code}
                  onChange={(e) => handleIsinChange(e.target.value.toUpperCase())}
                  placeholder="INE000000000"
                  style={isinLen > 0 && !isinValid ? { borderColor: "var(--danger)" } : undefined}
                />
                {isinLen > 0 ? (
                  <div style={{ fontSize: 11, marginTop: 3, color: isinValid ? "var(--success, #16a34a)" : "var(--danger)" }}>
                    {isinLen}/12{isinValid ? " — valid format" : isinLen > 12 ? " — too long" : " — must be 12 alphanumeric characters"}
                  </div>
                ) : (
                  <div style={{ fontSize: 11, marginTop: 3, color: "var(--text-muted)" }}>
                    Provide an ISIN or an ARN number
                  </div>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">ARN Number</label>
                <input
                  className="input"
                  value={form.arn_number}
                  onChange={(e) => set("arn_number", e.target.value.toUpperCase())}
                  placeholder="ARN-12345"
                />
                <div style={{ fontSize: 11, marginTop: 3, color: "var(--text-muted)" }}>
                  Used as the key when no ISIN is available
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Company Name</label>
                <input className="input" value={form.company_name} onChange={(e) => set("company_name", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">NSDL RTA Code</label>
                <input className="input" value={form.nsdl_rta_code} onChange={(e) => set("nsdl_rta_code", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">CDSL RTA Code</label>
                <input className="input" value={form.cdsl_rta_code} onChange={(e) => set("cdsl_rta_code", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Security Type</label>
                <input
                  className="input"
                  value={form.security_type}
                  onChange={(e) => handleSecurityTypeChange(e.target.value)}
                  placeholder="Auto-filled from ISIN…"
                />
                {secAutoFilled && (
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>
                    Auto-detected from ISIN — edit freely
                  </div>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Face Value (₹)</label>
                <input className="input" type="number" min="0" step="any" value={form.face_value ?? ""} onChange={(e) => set("face_value", e.target.value)} />
              </div>
            </div>

            <hr className="divider" />
            <div style={{ fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--text-muted)", marginBottom: 2 }}>Contact</div>
            <div className="form-group">
              <label className="form-label">Email IDs</label>
              <ArrayFieldEditor values={form.email_ids} onChange={(v) => set("email_ids", v)} placeholder="email@example.com" inputType="email" />
            </div>
            <div className="form-group">
              <label className="form-label">Contact Numbers</label>
              <ArrayFieldEditor values={form.contact_numbers} onChange={(v) => set("contact_numbers", v)} placeholder="+91 XXXXX XXXXX" inputType="tel" />
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Authorized Person</label>
                <input className="input" value={form.authorized_person_name} onChange={(e) => set("authorized_person_name", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Designation</label>
                <input className="input" value={form.authorized_person_designation} onChange={(e) => set("authorized_person_designation", e.target.value)} />
              </div>
            </div>

            <hr className="divider" />
            <div style={{ fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--text-muted)", marginBottom: 2 }}>Tax & Legal</div>
            <div className="grid-3">
              <div className="form-group">
                <label className="form-label">GST Number</label>
                <input className="input" value={form.gst_number} onChange={(e) => set("gst_number", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">TAN Number</label>
                <input className="input" value={form.tan_number} onChange={(e) => set("tan_number", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">PAN Number</label>
                <input className="input" value={form.pan_number} onChange={(e) => set("pan_number", e.target.value)} />
              </div>
            </div>

            <hr className="divider" />
            <div style={{ fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--text-muted)", marginBottom: 2 }}>Registered Address</div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Line 1</label>
                <input className="input" value={form.reg_address_line1} onChange={(e) => set("reg_address_line1", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Line 2</label>
                <input className="input" value={form.reg_address_line2} onChange={(e) => set("reg_address_line2", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Line 3</label>
                <input className="input" value={form.reg_address_line3} onChange={(e) => set("reg_address_line3", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Line 4</label>
                <input className="input" value={form.reg_address_line4} onChange={(e) => set("reg_address_line4", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">City</label>
                <input className="input" value={form.reg_city} onChange={(e) => set("reg_city", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Pin Code</label>
                <input className="input" value={form.reg_pin_code} onChange={(e) => set("reg_pin_code", e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Billing Address</label>
              <textarea className="input" rows={2} value={form.billing_address} onChange={(e) => set("billing_address", e.target.value)} />
            </div>

            <hr className="divider" />
            <div style={{ fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--text-muted)", marginBottom: 2 }}>Share Details</div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Total Shares</label>
                <input className="input" type="number" min="0" value={form.total_shares} onChange={(e) => set("total_shares", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Physical Shares</label>
                <input className="input" type="number" min="0" value={form.physical_shares} onChange={(e) => set("physical_shares", e.target.value)} />
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <label className="checkbox-row" style={{ marginBottom: 6 }}>
                  <input type="checkbox" checked={form.has_nsdl_shares} onChange={(e) => set("has_nsdl_shares", e.target.checked)} />
                  <span className="form-label" style={{ margin: 0 }}>Has NSDL Shares</span>
                </label>
                {form.has_nsdl_shares && (
                  <div className="form-group">
                    <label className="form-label">NSDL Shares</label>
                    <input className="input" type="number" min="0" value={form.nsdl_shares} onChange={(e) => set("nsdl_shares", e.target.value)} />
                  </div>
                )}
              </div>
              <div>
                <label className="checkbox-row" style={{ marginBottom: 6 }}>
                  <input type="checkbox" checked={form.has_cdsl_shares} onChange={(e) => set("has_cdsl_shares", e.target.checked)} />
                  <span className="form-label" style={{ margin: 0 }}>Has CDSL Shares</span>
                </label>
                {form.has_cdsl_shares && (
                  <div className="form-group">
                    <label className="form-label">CDSL Shares</label>
                    <input className="input" type="number" min="0" value={form.cdsl_shares} onChange={(e) => set("cdsl_shares", e.target.value)} />
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <span className="spinner" /> : "Create Company"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
