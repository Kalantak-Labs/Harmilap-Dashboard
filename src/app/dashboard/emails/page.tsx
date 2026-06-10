"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Eye, Mail, Plus, RefreshCw, Search, Send, Settings, Trash2, X, Zap } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/Toast";
import ConfirmModal from "@/components/ui/ConfirmModal";
import type {
  CompanyListItem, EmailSettings, EmailTemplate, EmailType,
  SendResponse, SendResultItem, TemplateVariable,
} from "@/lib/types";

// ── SMTP presets ──────────────────────────────────────────────────────────────

const SMTP_PRESETS: Record<string, { label: string; host: string; port: number; tls: boolean; note: string }> = {
  outlook: {
    label: "Outlook / Microsoft 365",
    host: "smtp.office365.com",
    port: 587,
    tls: true,
    note: "Use your full email address as username. Business M365 accounts may need SMTP AUTH enabled per-user in the Microsoft 365 admin centre (Users → select user → Mail → SMTP AUTH).",
  },
  gmail: {
    label: "Gmail",
    host: "smtp.gmail.com",
    port: 587,
    tls: true,
    note: "Enable 2-Step Verification on your Google account, then create an App Password (myaccount.google.com → Security → App passwords) and use that as the password here.",
  },
  yahoo: {
    label: "Yahoo Mail",
    host: "smtp.mail.yahoo.com",
    port: 587,
    tls: true,
    note: "Generate an App Password in your Yahoo account security settings and use it as the password.",
  },
};

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<EmailType, string> = {
  invoice: "Tax Invoice",
  benpos: "BENPOS Report",
  reconciliation: "Reconciliation Report",
};

const TYPE_COLORS: Record<EmailType, string> = {
  invoice: "#7c3aed",
  benpos: "#0369a1",
  reconciliation: "#065f46",
};

// ── Settings section ──────────────────────────────────────────────────────────

function SettingsSection({ isAdmin }: { isAdmin: boolean }) {
  const { push } = useToast();
  const [settings, setSettings] = useState<EmailSettings | null>(null);
  const [form, setForm] = useState({
    smtp_host: "", smtp_port: 587, smtp_username: "", smtp_password: "",
    smtp_use_tls: true, sender_name: "", sender_email: "",
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [preset, setPreset] = useState("");

  const load = useCallback(async () => {
    try {
      const s = await api.emails.getSettings();
      setSettings(s);
      setForm({
        smtp_host: s.smtp_host || "",
        smtp_port: s.smtp_port,
        smtp_username: s.smtp_username || "",
        smtp_password: s.smtp_password || "",
        smtp_use_tls: s.smtp_use_tls,
        sender_name: s.sender_name || "",
        sender_email: s.sender_email || "",
      });
    } catch { /* silently ignore on non-admin */ }
  }, []);

  useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);

  if (!isAdmin) {
    return (
      <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>
        <Settings size={32} style={{ marginBottom: 8, opacity: .4 }} />
        <div>Only admins can configure email settings.</div>
      </div>
    );
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const s = await api.emails.updateSettings({
        ...form,
        smtp_port: Number(form.smtp_port),
      });
      setSettings(s);
      push("success", "Email settings saved");
    } catch (err: unknown) {
      push("error", err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const testConn = async () => {
    setTesting(true);
    try {
      const res = await api.emails.testConnection();
      push("success", res.message);
    } catch (err: unknown) {
      push("error", err instanceof Error ? err.message : "Connection failed");
    } finally {
      setTesting(false);
    }
  };

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const applyPreset = (key: string) => {
    setPreset(key);
    const p = SMTP_PRESETS[key];
    if (p) setForm((f) => ({ ...f, smtp_host: p.host, smtp_port: p.port, smtp_use_tls: p.tls }));
  };

  return (
    <div className="card" style={{ maxWidth: 600 }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontWeight: 600 }}>SMTP Configuration</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Used for sending all report emails</div>
        </div>
        {settings && (
          <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 20, background: settings.is_configured ? "#dcfce7" : "#fee2e2", color: settings.is_configured ? "#15803d" : "#dc2626", fontWeight: 500 }}>
            {settings.is_configured ? "Configured" : "Not configured"}
          </span>
        )}
      </div>
      <form onSubmit={save} style={{ padding: 20 }}>
        {/* Quick setup presets */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>Quick setup</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {Object.entries(SMTP_PRESETS).map(([key, p]) => (
              <button key={key} type="button"
                onClick={() => applyPreset(key)}
                style={{ fontSize: 12, padding: "4px 12px", borderRadius: 20, border: `1px solid ${preset === key ? "var(--accent)" : "var(--border)"}`, background: preset === key ? "var(--accent)" : "transparent", color: preset === key ? "#fff" : "var(--text-secondary)", cursor: "pointer", transition: "all .15s" }}>
                {p.label}
              </button>
            ))}
          </div>
          {preset && SMTP_PRESETS[preset] && (
            <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-secondary)", background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: "var(--radius-sm)", padding: "8px 10px" }}>
              ℹ {SMTP_PRESETS[preset].note}
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 12, marginBottom: 12 }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label required">SMTP Host</label>
            <input className="input" value={form.smtp_host} onChange={(e) => set("smtp_host", e.target.value)} placeholder="smtp.gmail.com" required />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Port</label>
            <input className="input" type="number" value={form.smtp_port} onChange={(e) => set("smtp_port", e.target.value)} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Username</label>
            <input className="input" value={form.smtp_username} onChange={(e) => set("smtp_username", e.target.value)} placeholder="you@gmail.com" autoComplete="off" />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Password / App Password</label>
            <div style={{ position: "relative" }}>
              <input className="input" type={showPw ? "text" : "password"} value={form.smtp_password} onChange={(e) => set("smtp_password", e.target.value)} autoComplete="new-password" style={{ paddingRight: 36 }} />
              <button type="button" onClick={() => setShowPw((v) => !v)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", fontSize: 11 }}>
                {showPw ? "Hide" : "Show"}
              </button>
            </div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label required">Sender Name</label>
            <input className="input" value={form.sender_name} onChange={(e) => set("sender_name", e.target.value)} placeholder="Harmilap RTA" required />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label required">Sender Email</label>
            <input className="input" type="email" value={form.sender_email} onChange={(e) => set("sender_email", e.target.value)} placeholder="rta@example.com" required />
          </div>
        </div>
        <label className="checkbox-row" style={{ marginBottom: 16 }}>
          <input type="checkbox" checked={form.smtp_use_tls} onChange={(e) => set("smtp_use_tls", e.target.checked)} />
          <span className="form-label" style={{ margin: 0 }}>Use STARTTLS (recommended for port 587)</span>
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <span className="spinner" /> : <Check size={14} />} Save Settings
          </button>
          <button type="button" className="btn btn-secondary" onClick={testConn} disabled={testing}>
            {testing ? <span className="spinner" /> : <Zap size={14} />} Test Connection
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Template editor modal ─────────────────────────────────────────────────────

interface TemplateModalProps {
  template?: EmailTemplate;
  variables: Record<string, TemplateVariable[]>;
  onClose: () => void;
  onSaved: () => void;
}

function TemplateModal({ template, variables, onClose, onSaved }: TemplateModalProps) {
  const { push } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    email_type: template?.email_type ?? ("invoice" as EmailType),
    name: template?.name ?? "",
    subject: template?.subject ?? "",
    body: template?.body ?? "",
    is_default: template?.is_default ?? false,
  });
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const insertVar = (key: string, target: "subject" | "body") => {
    const token = `{{${key}}}`;
    if (target === "subject" && subjectRef.current) {
      const el = subjectRef.current;
      const start = el.selectionStart ?? el.value.length;
      const end   = el.selectionEnd   ?? el.value.length;
      const newVal = el.value.slice(0, start) + token + el.value.slice(end);
      setForm((f) => ({ ...f, subject: newVal }));
      setTimeout(() => { el.focus(); el.setSelectionRange(start + token.length, start + token.length); }, 0);
    } else if (bodyRef.current) {
      const el = bodyRef.current;
      const start = el.selectionStart ?? el.value.length;
      const end   = el.selectionEnd   ?? el.value.length;
      const newVal = el.value.slice(0, start) + token + el.value.slice(end);
      setForm((f) => ({ ...f, body: newVal }));
      setTimeout(() => { el.focus(); el.setSelectionRange(start + token.length, start + token.length); }, 0);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.subject.trim()) { push("error", "Name and subject are required"); return; }
    setLoading(true);
    try {
      if (template) {
        await api.emails.updateTemplate(template.id, form);
        push("success", "Template updated");
      } else {
        await api.emails.createTemplate(form);
        push("success", "Template created");
      }
      onSaved();
    } catch (err: unknown) {
      push("error", err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  const currentVars = variables[form.email_type] ?? [];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 700 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{template ? "Edit Template" : "New Template"}</h2>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div className="modal-body" style={{ overflowY: "auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label required">Template Name</label>
                <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Standard Invoice" required />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label required">Email Type</label>
                <select className="input" value={form.email_type}
                  onChange={(e) => setForm((f) => ({ ...f, email_type: e.target.value as EmailType }))}
                  disabled={!!template}>
                  {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>

            {/* Variable picker */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--text-muted)", marginBottom: 6 }}>
                Available variables — click to insert at cursor
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {currentVars.map((v) => (
                  <div key={v.key} style={{ display: "flex", gap: 2 }}>
                    <button type="button"
                      onClick={() => insertVar(v.key, "subject")}
                      title={`Insert into subject`}
                      style={{ fontSize: 11, padding: "2px 7px", borderRadius: "3px 0 0 3px", border: "1px solid var(--border)", background: "var(--bg)", cursor: "pointer", color: "var(--text-secondary)" }}>
                      S
                    </button>
                    <button type="button"
                      onClick={() => insertVar(v.key, "body")}
                      title={`Insert {{${v.key}}} into body`}
                      style={{ fontSize: 11, padding: "2px 8px", borderRadius: "0 3px 3px 0", border: "1px solid var(--border)", borderLeft: "none", background: "var(--bg)", cursor: "pointer", color: "var(--text)" }}>
                      {`{{${v.key}}}`}
                    </button>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>S = insert into Subject · right button = insert into Body</div>
            </div>

            <div className="form-group" style={{ margin: 0, marginBottom: 12 }}>
              <label className="form-label required">Subject</label>
              <input ref={subjectRef} className="input" value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                placeholder="e.g. Tax Invoice — {{company_name}} — {{fiscal_year}}" required />
            </div>

            <div className="form-group" style={{ margin: 0, marginBottom: 12 }}>
              <label className="form-label required">Body (HTML supported)</label>
              <textarea ref={bodyRef} className="input" rows={12}
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                style={{ fontFamily: "monospace", fontSize: 12, resize: "vertical" }}
                placeholder={`Dear {{authorized_person_name}},\n\nPlease find attached the Tax Invoice for {{company_name}} (ISIN: {{isin_code}}) for FY {{fiscal_year}}.\n\nInvoice No: {{invoice_no}}\n\nRegards,\nHarmilap RTA`}
              />
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>Plain text works too — line breaks are auto-converted. HTML tags like &lt;b&gt;, &lt;br&gt;, &lt;p&gt; are supported.</div>
            </div>

            <label className="checkbox-row">
              <input type="checkbox" checked={form.is_default}
                onChange={(e) => setForm((f) => ({ ...f, is_default: e.target.checked }))} />
              <span className="form-label" style={{ margin: 0 }}>Set as default for {TYPE_LABELS[form.email_type]}</span>
            </label>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <span className="spinner" /> : <Check size={14} />}
              {template ? "Save Changes" : "Create Template"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Templates section ─────────────────────────────────────────────────────────

function TemplatesSection({ canEdit, variables }: { canEdit: boolean; variables: Record<string, TemplateVariable[]> }) {
  const { push } = useToast();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTmpl, setEditTmpl] = useState<EmailTemplate | undefined>(undefined);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTmpl, setDeleteTmpl] = useState<EmailTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setTemplates(await api.emails.listTemplates()); }
    catch { push("error", "Failed to load templates"); }
    finally { setLoading(false); }
  }, [push]);

  useEffect(() => { load(); }, [load]);

  const doDelete = async () => {
    if (!deleteTmpl) return;
    setDeleting(true);
    try {
      await api.emails.deleteTemplate(deleteTmpl.id);
      push("success", "Template deleted");
      setDeleteTmpl(null);
      load();
    } catch (err: unknown) {
      push("error", err instanceof Error ? err.message : "Delete failed");
    } finally { setDeleting(false); }
  };

  const grouped = (["invoice", "benpos", "reconciliation"] as EmailType[]).map((type) => ({
    type, label: TYPE_LABELS[type], color: TYPE_COLORS[type],
    items: templates.filter((t) => t.email_type === type),
  }));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        {canEdit && (
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={14} /> New Template
          </button>
        )}
      </div>
      {loading ? (
        <div className="spinner-center"><span className="spinner" /></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {grouped.map(({ type, label, color, items }) => (
            <div key={type} className="card">
              <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: color, display: "inline-block" }} />
                <span style={{ fontWeight: 600, fontSize: 13 }}>{label}</span>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{items.length} template{items.length !== 1 ? "s" : ""}</span>
              </div>
              {items.length === 0 ? (
                <div style={{ padding: "20px 16px", color: "var(--text-muted)", fontSize: 13, textAlign: "center" }}>
                  No templates yet — create one to send {label} emails
                </div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Subject</th>
                        <th>Default</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((t) => (
                        <tr key={t.id}>
                          <td style={{ fontWeight: 500 }}>{t.name}</td>
                          <td style={{ color: "var(--text-secondary)", fontSize: 12, maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.subject}</td>
                          <td>{t.is_default && <span className="badge badge-green" style={{ fontSize: 11 }}>Default</span>}</td>
                          <td>
                            <div style={{ display: "flex", gap: 4 }}>
                              {canEdit && (
                                <>
                                  <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setEditTmpl(t)} title="Edit">
                                    <Mail size={13} />
                                  </button>
                                  <button className="btn btn-ghost btn-sm btn-icon" style={{ color: "var(--danger)" }} onClick={() => setDeleteTmpl(t)}>
                                    <Trash2 size={13} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {showCreate && (
        <TemplateModal variables={variables} onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load(); }} />
      )}
      {editTmpl && (
        <TemplateModal template={editTmpl} variables={variables} onClose={() => setEditTmpl(undefined)} onSaved={() => { setEditTmpl(undefined); load(); }} />
      )}
      {deleteTmpl && (
        <ConfirmModal
          title="Delete Template"
          message={`Delete template "${deleteTmpl.name}"? This cannot be undone.`}
          confirmLabel="Delete"
          danger loading={deleting}
          onConfirm={doDelete}
          onClose={() => setDeleteTmpl(null)}
        />
      )}
    </div>
  );
}

// ── Preview modal ─────────────────────────────────────────────────────────────

function PreviewModal({ tid, company, params, onClose }: {
  tid: string; company: CompanyListItem;
  params: { report_date?: string; ref_prefix?: string };
  onClose: () => void;
}) {
  const [data, setData] = useState<{ subject: string; body: string; to: string[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const { push } = useToast();

  useEffect(() => {
    api.emails.previewTemplate(tid, company.id, params)
      .then(setData)
      .catch((e: unknown) => push("error", e instanceof Error ? e.message : "Preview failed"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 680 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>Email Preview</h2>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>For: {company.company_name ?? company.isin_code}</div>
          </div>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body" style={{ overflowY: "auto" }}>
          {loading ? (
            <div className="spinner-center"><span className="spinner" /></div>
          ) : data ? (
            <div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 3 }}>To</div>
                <div style={{ fontSize: 13 }}>{data.to.length ? data.to.join(", ") : <span style={{ color: "var(--danger)" }}>No email address on file</span>}</div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 3 }}>Subject</div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{data.subject}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 6 }}>Body</div>
                <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: 16, fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap", background: "#fff" }}
                  dangerouslySetInnerHTML={{ __html: data.body.replace(/\n/g, "<br>") }} />
              </div>
            </div>
          ) : null}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Send section ──────────────────────────────────────────────────────────────

function SendSection({ variables }: { variables: Record<string, TemplateVariable[]> }) {
  const { push } = useToast();

  const [emailType, setEmailType] = useState<EmailType>("invoice");
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTid, setSelectedTid] = useState("");
  const [reportDate, setReportDate] = useState("");
  const [refPrefix, setRefPrefix] = useState("");

  const [companies, setCompanies] = useState<CompanyListItem[]>([]);
  const [compSearch, setCompSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [previewCompany, setPreviewCompany] = useState<CompanyListItem | null>(null);

  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<SendResponse | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // Load templates for selected type
  useEffect(() => {
    api.emails.listTemplates(emailType).then((list) => {
      setTemplates(list);
      const def = list.find((t) => t.is_default) ?? list[0];
      setSelectedTid(def?.id ?? "");
    }).catch(() => {});
    setSelectedIds(new Set());
    setSendResult(null);
  }, [emailType]);

  // Load all companies (paginate in batches of 500 to bypass the per-request cap)
  useEffect(() => {
    const fetchAll = async () => {
      const PAGE = 500;
      let skip = 0;
      const all: CompanyListItem[] = [];
      while (true) {
        const page = await api.companies.list({ limit: PAGE, skip });
        all.push(...page);
        if (page.length < PAGE) break;
        skip += PAGE;
      }
      setCompanies(all);
    };
    fetchAll().catch(() => {});
  }, []);

  const filtered = companies.filter((c) => {
    const q = compSearch.toLowerCase();
    return !q || (c.company_name ?? "").toLowerCase().includes(q) || c.isin_code.toLowerCase().includes(q);
  });

  const toggleCompany = (id: string) => {
    setSelectedIds((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((c) => c.id)));
    }
  };

  const doSend = async () => {
    setShowConfirm(false);
    setSending(true);
    setSendResult(null);
    try {
      const result = await api.emails.send({
        email_type: emailType,
        template_id: selectedTid,
        company_ids: Array.from(selectedIds),
        ...(reportDate ? { report_date: reportDate } : {}),
        ...(refPrefix ? { ref_prefix: refPrefix } : {}),
      });
      setSendResult(result);
      if (result.sent > 0) push("success", `${result.sent} email${result.sent > 1 ? "s" : ""} sent`);
      if (result.failed > 0) push("error", `${result.failed} failed`);
    } catch (err: unknown) {
      push("error", err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  };

  const selectedTemplate = templates.find((t) => t.id === selectedTid);
  const firstSelected = companies.find((c) => selectedIds.has(c.id));
  const canSend = selectedIds.size > 0 && selectedTid && !sending;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 16, alignItems: "start" }}>
      {/* Left: Config panel */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Email type */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--text-muted)", marginBottom: 10 }}>Email Type</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(Object.entries(TYPE_LABELS) as [EmailType, string][]).map(([k, label]) => (
              <label key={k} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: "var(--radius-sm)", border: `1px solid ${emailType === k ? TYPE_COLORS[k] : "var(--border)"}`, cursor: "pointer", background: emailType === k ? `${TYPE_COLORS[k]}08` : "transparent", transition: "all .15s" }}>
                <input type="radio" name="emailType" value={k} checked={emailType === k} onChange={() => setEmailType(k)} style={{ accentColor: TYPE_COLORS[k] }} />
                <div>
                  <div style={{ fontWeight: 500, fontSize: 13, color: emailType === k ? TYPE_COLORS[k] : "var(--text)" }}>{label}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>PDF attached</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Template */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--text-muted)", marginBottom: 10 }}>Template</div>
          {templates.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--danger)" }}>No templates for {TYPE_LABELS[emailType]}. Create one in the Templates tab first.</div>
          ) : (
            <select className="input input-sm" value={selectedTid} onChange={(e) => setSelectedTid(e.target.value)}>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}{t.is_default ? " (default)" : ""}</option>
              ))}
            </select>
          )}
          {selectedTemplate && (
            <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-secondary)", background: "var(--bg)", padding: "6px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
              Subject: {selectedTemplate.subject}
            </div>
          )}
        </div>

        {/* Optional params */}
        {(emailType === "benpos" || emailType === "reconciliation") && (
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--text-muted)", marginBottom: 10 }}>Optional Parameters</div>
            <div className="form-group" style={{ margin: 0, marginBottom: 10 }}>
              <label className="form-label">Report Date (as on)</label>
              <input className="input input-sm" type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} />
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Defaults to latest record date</div>
            </div>
            {emailType === "reconciliation" && (
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Reference Prefix</label>
                <input className="input input-sm" value={refPrefix} onChange={(e) => setRefPrefix(e.target.value)} placeholder="2025-26/NSDL/MAR26" />
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                  Full ref: {refPrefix ? `${refPrefix}/RTAN{rta_code}` : "RTAN{rta_code}"}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right: Company picker + actions */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="card">
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>
              Select Companies
              {selectedIds.size > 0 && <span style={{ marginLeft: 8, fontSize: 12, color: "var(--text-muted)" }}>{selectedIds.size} selected</span>}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {firstSelected && selectedTid && (
                <button className="btn btn-ghost btn-sm" onClick={() => setPreviewCompany(firstSelected)}>
                  <Eye size={13} /> Preview
                </button>
              )}
              <div style={{ position: "relative" }}>
                <Search size={13} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                <input className="input input-sm" style={{ paddingLeft: 26, width: 180 }} placeholder="Search name or ISIN…"
                  value={compSearch} onChange={(e) => setCompSearch(e.target.value)} />
              </div>
            </div>
          </div>
          <div style={{ maxHeight: 340, overflowY: "auto" }}>
            {filtered.length === 0 ? (
              <div style={{ padding: "24px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>No companies found</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ width: 36, padding: "8px 12px" }}>
                      <input type="checkbox" checked={filtered.length > 0 && selectedIds.size === filtered.length}
                        ref={(el) => { if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < filtered.length; }}
                        onChange={toggleAll} style={{ accentColor: "var(--accent)" }} />
                    </th>
                    <th>Company</th>
                    <th>ISIN</th>
                    <th>Email</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => {
                    const checked = selectedIds.has(c.id);
                    return (
                      <tr key={c.id} onClick={() => toggleCompany(c.id)} style={{ cursor: "pointer", background: checked ? "var(--bg)" : "transparent" }}>
                        <td style={{ padding: "8px 12px" }}>
                          <input type="checkbox" checked={checked} onChange={() => toggleCompany(c.id)}
                            onClick={(e) => e.stopPropagation()} style={{ accentColor: "var(--accent)" }} />
                        </td>
                        <td style={{ fontWeight: checked ? 500 : 400, fontSize: 13 }}>{c.company_name ?? <span style={{ color: "var(--text-muted)" }}>—</span>}</td>
                        <td><code style={{ fontSize: 11, background: "var(--bg)", padding: "1px 5px", borderRadius: 3 }}>{c.isin_code}</code></td>
                        <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                          {/* Company list doesn't include email_ids, so just show availability indicator */}
                          <span style={{ fontSize: 11 }}>in record</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Send bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button className="btn btn-primary" disabled={!canSend} onClick={() => setShowConfirm(true)} style={{ minWidth: 140 }}>
            {sending ? <span className="spinner" /> : <Send size={14} />}
            {sending ? "Sending…" : `Send to ${selectedIds.size || "0"} compan${selectedIds.size === 1 ? "y" : "ies"}`}
          </button>
          {selectedIds.size > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={() => setSelectedIds(new Set())}>
              <X size={13} /> Clear selection
            </button>
          )}
        </div>

        {/* Results */}
        {sendResult && (
          <div className="card" style={{ overflow: "hidden" }}>
            <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>
                Send Results
                <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 400, color: "var(--text-muted)" }}>
                  {sendResult.sent} sent · {sendResult.failed} failed · {sendResult.no_email} no email
                </span>
              </div>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setSendResult(null)}><X size={13} /></button>
            </div>
            <div className="table-wrap" style={{ maxHeight: 260 }}>
              <table>
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>To</th>
                    <th>Status</th>
                    <th>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {sendResult.results.map((r) => (
                    <tr key={r.company_id}>
                      <td style={{ fontWeight: 500, fontSize: 13 }}>{r.company_name ?? r.company_id}</td>
                      <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{r.emails.join(", ") || "—"}</td>
                      <td>
                        {r.status === "sent"     && <span className="badge badge-green">Sent</span>}
                        {r.status === "failed"   && <span className="badge badge-red">Failed</span>}
                        {r.status === "no_email" && <span className="badge badge-gray">No email</span>}
                      </td>
                      <td style={{ fontSize: 12, color: "var(--danger)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.error ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Confirm modal */}
      {showConfirm && selectedTemplate && (
        <ConfirmModal
          title={`Send ${TYPE_LABELS[emailType]}`}
          message={`Send "${selectedTemplate.name}" to ${selectedIds.size} compan${selectedIds.size === 1 ? "y" : "ies"}? Each company will receive the PDF attachment.${emailType === "invoice" ? " This will create a new invoice number for each company." : ""}`}
          confirmLabel="Send Now"
          loading={sending}
          onConfirm={doSend}
          onClose={() => setShowConfirm(false)}
        />
      )}

      {/* Preview modal */}
      {previewCompany && selectedTid && (
        <PreviewModal
          tid={selectedTid} company={previewCompany}
          params={{ report_date: reportDate || undefined, ref_prefix: refPrefix || undefined }}
          onClose={() => setPreviewCompany(null)}
        />
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type Tab = "settings" | "templates" | "send";

export default function EmailsPage() {
  const { can, isAdmin } = useAuth();
  const [tab, setTab] = useState<Tab>("send");
  const [variables, setVariables] = useState<Record<string, TemplateVariable[]>>({});

  useEffect(() => {
    api.emails.getVariables().then(setVariables).catch(() => {});
  }, []);

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "send", label: "Send Email", icon: <Send size={14} /> },
    { key: "templates", label: "Templates", icon: <Mail size={14} /> },
    { key: "settings", label: "SMTP Settings", icon: <Settings size={14} /> },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Email</h2>
          <div style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 2 }}>Send reports to companies by email with PDF attachments</div>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 2, marginBottom: 20, borderBottom: "1px solid var(--border)", paddingBottom: 0 }}>
        {tabs.map(({ key, label, icon }) => (
          <button key={key} onClick={() => setTab(key)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 16px", fontSize: 13, fontWeight: 500, border: "none", cursor: "pointer",
              background: "transparent", borderBottom: tab === key ? "2px solid var(--accent)" : "2px solid transparent",
              color: tab === key ? "var(--text)" : "var(--text-muted)",
              marginBottom: -1, transition: "color .15s",
            }}>
            {icon} {label}
          </button>
        ))}
      </div>

      {tab === "send"      && <SendSection variables={variables} />}
      {tab === "templates" && <TemplatesSection canEdit={can("editor")} variables={variables} />}
      {tab === "settings"  && <SettingsSection isAdmin={isAdmin} />}
    </div>
  );
}
