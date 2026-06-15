"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Download, Upload, Search, X, RefreshCw, Receipt, Settings, Plus, Trash2,
  Check, FileDown,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/Toast";
import type { PartyListItem, Invoice, Particular } from "@/lib/types";

function computeTotal(
  particulars: Particular[], gstType: string,
  igst: number, cgst: number, sgst: number,
): number {
  const enabled = particulars.filter((p) => p.enabled);
  const taxable = enabled.filter((p) => !p.non_taxable).reduce((s, p) => s + (p.amount || 0), 0);
  const nonTax = enabled.filter((p) => p.non_taxable).reduce((s, p) => s + (p.amount || 0), 0);
  const gst = gstType === "IGST"
    ? Math.round(taxable * igst / 100)
    : Math.round(taxable * cgst / 100) + Math.round(taxable * sgst / 100);
  return taxable + nonTax + gst;
}

const inr = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export default function InvoicesPage() {
  const { can } = useAuth();
  const { push } = useToast();
  const router = useRouter();

  const [parties, setParties] = useState<PartyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Editor modal
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setParties(await api.invoices.listParties(search || undefined));
    } catch (e: unknown) {
      push("error", e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [search]);

  const openEditor = async (partyKey: string) => {
    setBusy(`edit:${partyKey}`);
    try {
      setEditing(await api.invoices.getInvoice(partyKey));
    } catch (e: unknown) {
      push("error", e instanceof Error ? e.message : "Failed to load invoice");
    } finally {
      setBusy(null);
    }
  };

  const downloadPdf = async (party: PartyListItem) => {
    setBusy(`pdf:${party.party_key}`);
    try {
      await api.reports.generate(
        api.invoices.pdfUrl(party.party_key),
        `Invoice_${party.company_name || party.party_key}.pdf`,
      );
    } catch (e: unknown) {
      push("error", e instanceof Error ? e.message : "Generation failed");
    } finally {
      setBusy(null);
    }
  };

  const bulkZip = async () => {
    setBusy("bulk");
    try {
      await api.reports.generate(api.invoices.bulkUrl(), "Invoices_Bulk.zip");
    } catch (e: unknown) {
      push("error", e instanceof Error ? e.message : "Bulk generation failed");
    } finally {
      setBusy(null);
    }
  };

  const exportExcel = async () => {
    setBusy("export");
    try {
      await api.invoices.exportExcel();
    } catch (e: unknown) {
      push("error", e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(null);
    }
  };

  const importZip = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setBusy("import");
    try {
      const summary = await api.invoices.importZip(file);
      push("success", `Import complete${summary ? ` — ${summary.replace(/,/g, " · ")}` : ""}. ZIP downloaded.`);
      load();
    } catch (err: unknown) {
      push("error", err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(null);
    }
  };

  // ── Editor helpers ──────────────────────────────────────────────────────────
  const patchParticular = (id: number, p: Partial<Particular>) =>
    setEditing((inv) => inv ? {
      ...inv,
      particulars: inv.particulars.map((it) => it.id === id ? { ...it, ...p } : it),
    } : inv);

  const addParticular = () =>
    setEditing((inv) => inv ? {
      ...inv,
      particulars: [...inv.particulars, {
        id: Math.max(0, ...inv.particulars.map((p) => p.id)) + 1,
        description: "", sac_code: "997159", amount: 0,
        is_red: false, non_taxable: false, enabled: true,
      }],
    } : inv);

  const removeParticular = (id: number) =>
    setEditing((inv) => inv ? { ...inv, particulars: inv.particulars.filter((p) => p.id !== id) } : inv);

  const setEditField = <K extends keyof Invoice>(k: K, v: Invoice[K]) =>
    setEditing((inv) => inv ? { ...inv, [k]: v } : inv);

  const saveEdit = async () => {
    if (!editing) return;
    setSavingEdit(true);
    try {
      const updated = await api.invoices.updateInvoice(editing.party_key, {
        particulars: editing.particulars,
        gst_type: editing.gst_type,
        igst_rate: editing.igst_rate,
        cgst_rate: editing.cgst_rate,
        sgst_rate: editing.sgst_rate,
        payment_status: editing.payment_status,
        payment_date: editing.payment_date,
        amount_paid: editing.amount_paid,
      });
      setEditing(null);
      push("success", `Invoice saved${updated.invoice_no ? ` (${updated.invoice_no})` : ""}`);
      load();
    } catch (e: unknown) {
      push("error", e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingEdit(false);
    }
  };

  const editTotal = editing
    ? computeTotal(editing.particulars, editing.gst_type, editing.igst_rate, editing.cgst_rate, editing.sgst_rate)
    : 0;

  return (
    <div>
      {/* ── Editor modal ── */}
      {editing && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)" }} onClick={() => setEditing(null)} />
          <div className="card" style={{ position: "relative", zIndex: 1, width: 820, maxWidth: "94vw", maxHeight: "90vh", overflowY: "auto", padding: "22px 24px 18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{editing.company_name || editing.party_key}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                  {editing.nsdl_rta_code && <>NSDL RTA: <b>{editing.nsdl_rta_code}</b>&nbsp;&nbsp;</>}
                  {editing.cdsl_rta_code && <>CDSL RTA: <b>{editing.cdsl_rta_code}</b>&nbsp;&nbsp;</>}
                  · {editing.isins.length} ISIN(s) · {editing.invoice_no || "no invoice no yet"}
                </div>
              </div>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setEditing(null)}><X size={16} /></button>
            </div>

            {editing.isins.length > 0 && (
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 12, lineHeight: 1.5 }}>
                <b>ISINs:</b> {editing.isins.join(", ")}
              </div>
            )}

            {/* Particulars */}
            <div style={{ fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--text-muted)", marginBottom: 8 }}>Particulars</div>
            {editing.particulars.map((item, idx) => (
              <div key={item.id} style={{ display: "grid", gridTemplateColumns: "1fr 120px 110px auto auto auto", gap: 8, alignItems: "center", padding: "7px 0", borderBottom: idx < editing.particulars.length - 1 ? "1px solid var(--border-muted)" : "none" }}>
                <input className="input input-sm" placeholder="Description" value={item.description}
                  onChange={(e) => patchParticular(item.id, { description: e.target.value })} />
                <input className="input input-sm" placeholder="SAC Code" value={item.sac_code}
                  onChange={(e) => patchParticular(item.id, { sac_code: e.target.value })} />
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "var(--text-muted)" }}>₹</span>
                  <input className="input input-sm" type="number" min="0" value={item.amount} style={{ paddingLeft: 22 }}
                    onChange={(e) => patchParticular(item.id, { amount: Number(e.target.value) })} />
                </div>
                <label title="Show in red" style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: item.is_red ? "#C00000" : "var(--text-muted)", cursor: "pointer" }}>
                  <input type="checkbox" checked={item.is_red} onChange={(e) => patchParticular(item.id, { is_red: e.target.checked })} style={{ accentColor: "#C00000" }} /> Red
                </label>
                <label title="Include" style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: item.enabled ? "var(--accent)" : "var(--text-muted)", cursor: "pointer" }}>
                  <input type="checkbox" checked={item.enabled} onChange={(e) => patchParticular(item.id, { enabled: e.target.checked })} style={{ accentColor: "var(--accent)" }} /> {item.enabled ? "On" : "Off"}
                </label>
                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => removeParticular(item.id)} style={{ color: "var(--danger)" }}><Trash2 size={13} /></button>
              </div>
            ))}
            <div style={{ padding: "8px 0 12px" }}>
              <button className="btn btn-ghost btn-sm" onClick={addParticular}><Plus size={13} /> Add particular</button>
            </div>

            {/* GST + Payment */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 6 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--text-muted)", marginBottom: 8 }}>GST</div>
                <div className="form-group" style={{ marginBottom: 8 }}>
                  <label className="form-label">GST Type</label>
                  <select className="input input-sm" value={editing.gst_type}
                    onChange={(e) => setEditField("gst_type", e.target.value as "IGST" | "CGST_SGST")}>
                    <option value="IGST">IGST (Inter-state)</option>
                    <option value="CGST_SGST">CGST + SGST (Intra-state)</option>
                  </select>
                </div>
                {editing.gst_type === "IGST" ? (
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">IGST Rate (%)</label>
                    <input className="input input-sm" type="number" min="0" max="100" step="0.5" value={editing.igst_rate}
                      onChange={(e) => setEditField("igst_rate", Number(e.target.value))} />
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">CGST (%)</label>
                      <input className="input input-sm" type="number" min="0" max="50" step="0.5" value={editing.cgst_rate}
                        onChange={(e) => setEditField("cgst_rate", Number(e.target.value))} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">SGST (%)</label>
                      <input className="input input-sm" type="number" min="0" max="50" step="0.5" value={editing.sgst_rate}
                        onChange={(e) => setEditField("sgst_rate", Number(e.target.value))} />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <div style={{ fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--text-muted)", marginBottom: 8 }}>Payment</div>
                <div className="form-group" style={{ marginBottom: 8 }}>
                  <label className="form-label">Status</label>
                  <select className="input input-sm" value={editing.payment_status ? "paid" : "unpaid"}
                    onChange={(e) => setEditField("payment_status", e.target.value === "paid")}>
                    <option value="unpaid">Unpaid</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Payment Date</label>
                    <input className="input input-sm" type="date" value={editing.payment_date || ""}
                      onChange={(e) => setEditField("payment_date", e.target.value || null)} />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Amount Paid</label>
                    <input className="input input-sm" type="number" min="0" value={editing.amount_paid ?? ""}
                      onChange={(e) => setEditField("amount_paid", e.target.value === "" ? null : Number(e.target.value))} />
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
              <div style={{ fontSize: 14 }}>Grand Total: <b style={{ fontSize: 17 }}>{inr(editTotal)}</b></div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setEditing(null)}>Cancel</button>
                <button className="btn btn-primary btn-sm" onClick={saveEdit} disabled={savingEdit || !can("editor")}>
                  {savingEdit ? <span className="spinner" /> : <Check size={14} />} Save Invoice
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h2>Tax Invoices</h2>
          <div style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 2 }}>
            One invoice per company (grouped by RTA code) covering all its ISINs
          </div>
        </div>
        <div className="page-header-actions">
          {can("editor") && (
            <button className="btn btn-secondary" onClick={() => router.push("/dashboard/invoices/config")}>
              <Settings size={15} /> Particulars Template
            </button>
          )}
          {can("can_download") && (
            <>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={importZip} />
              <button className="btn btn-secondary" onClick={() => fileRef.current?.click()} disabled={busy === "import"}>
                {busy === "import" ? <span className="spinner" /> : <Upload size={15} />}
                {busy === "import" ? "Importing…" : "Import → ZIP"}
              </button>
              <button className="btn btn-secondary" onClick={exportExcel} disabled={busy === "export"}>
                <FileDown size={15} /> Export Excel
              </button>
              <button className="btn btn-primary" onClick={bulkZip} disabled={busy === "bulk"}>
                {busy === "bulk" ? <span className="spinner" /> : <Download size={15} />}
                {busy === "bulk" ? "Zipping…" : "Bulk ZIP"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Search ── */}
      <div className="filter-bar">
        <div style={{ position: "relative", flex: 1, minWidth: 200, maxWidth: 360 }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input className="input input-sm" style={{ paddingLeft: 32 }} placeholder="Search company, RTA code…"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {search && <button className="btn btn-ghost btn-sm" onClick={() => setSearch("")}><X size={13} /> Clear</button>}
        <button className="btn btn-ghost btn-sm btn-icon" onClick={load}><RefreshCw size={14} /></button>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-muted)" }}>{parties.length} parties</span>
      </div>

      {/* ── Table ── */}
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Company</th>
                <th>RTA Code(s)</th>
                <th style={{ textAlign: "center" }}>ISINs</th>
                <th>Invoice No</th>
                <th style={{ textAlign: "right" }}>Grand Total</th>
                <th style={{ textAlign: "center" }}>Payment</th>
                <th style={{ textAlign: "center" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7}><div className="spinner-center"><span className="spinner" /></div></td></tr>
              ) : parties.length === 0 ? (
                <tr><td colSpan={7}>
                  <div className="empty-state"><Receipt size={28} /><div>No invoiceable companies found</div>
                    <div style={{ fontSize: 12 }}>Companies need an NSDL or CDSL RTA code to be invoiced</div>
                  </div>
                </td></tr>
              ) : parties.map((p) => (
                <tr key={p.party_key}>
                  <td style={{ fontWeight: 500 }}>{p.company_name ?? <span style={{ color: "var(--text-muted)" }}>—</span>}</td>
                  <td style={{ fontSize: 12 }}>
                    {p.nsdl_rta_code && <span className="badge badge-gray" style={{ marginRight: 4 }}>N:{p.nsdl_rta_code}</span>}
                    {p.cdsl_rta_code && <span className="badge badge-blue">C:{p.cdsl_rta_code}</span>}
                  </td>
                  <td style={{ textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{p.isin_count}</td>
                  <td style={{ fontSize: 12 }}>{p.invoice_no ?? <span style={{ color: "var(--text-muted)" }}>—</span>}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{inr(p.grand_total)}</td>
                  <td style={{ textAlign: "center" }}>
                    {p.payment_status
                      ? <span className="badge badge-green">Paid</span>
                      : <span className="badge badge-gray">Unpaid</span>}
                  </td>
                  <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                    <button className="btn btn-ghost btn-sm" title="Edit invoice"
                      onClick={() => openEditor(p.party_key)} disabled={!!busy}>
                      {busy === `edit:${p.party_key}` ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <Settings size={14} />}
                    </button>
                    <button className="btn btn-ghost btn-sm btn-icon" title="Download PDF"
                      onClick={() => downloadPdf(p)} disabled={!!busy} style={{ color: "var(--accent)" }}>
                      {busy === `pdf:${p.party_key}` ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <Download size={14} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
