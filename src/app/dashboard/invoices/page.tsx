"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Download, Upload, Search, X, RefreshCw, Receipt, Settings, Plus, Trash2,
  Check, FileDown, History,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/Toast";
import type { PartyListItem, Invoice, Particular, InvoiceArchive } from "@/lib/types";

function computeTotal(
  particulars: Particular[], gstType: string,
  igst: number, cgst: number, sgst: number, units = 1,
): number {
  const enabled = particulars.filter((p) => p.enabled);
  const taxable = enabled.filter((p) => !p.non_taxable).reduce((s, p) => s + (p.amount || 0), 0) * units;
  const nonTax = enabled.filter((p) => p.non_taxable).reduce((s, p) => s + (p.amount || 0), 0); // flat — actual expenses
  const gst = gstType === "IGST"
    ? Math.round(taxable * igst / 100)
    : Math.round(taxable * cgst / 100) + Math.round(taxable * sgst / 100);
  return taxable + nonTax + gst;
}

const inr = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : null;

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
  const [defaultInvoiceNo, setDefaultInvoiceNo] = useState<string | null>(null);
  const [invoiceNoError, setInvoiceNoError] = useState<string | null>(null);
  const [checkingInvoiceNo, setCheckingInvoiceNo] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const checkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // History modal
  const [historyParty, setHistoryParty] = useState<PartyListItem | null>(null);
  const [archives, setArchives] = useState<InvoiceArchive[]>([]);
  const [loadingArchives, setLoadingArchives] = useState(false);

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
      const inv = await api.invoices.getInvoice(partyKey);
      const defaultNo = inv.default_invoice_no ?? inv.invoice_no ?? null;
      setDefaultInvoiceNo(defaultNo);
      setInvoiceNoError(null);
      setEditing({
        ...inv,
        invoice_no: inv.invoice_no ?? defaultNo ?? "",
        invoice_date: inv.invoice_date ?? new Date().toISOString().slice(0, 10),
      });
    } catch (e: unknown) {
      push("error", e instanceof Error ? e.message : "Failed to load invoice");
    } finally {
      setBusy(null);
    }
  };

  const validateInvoiceNo = useCallback(async (no: string, partyKey: string, defaultNo: string | null) => {
    const trimmed = no.trim();
    if (!trimmed) {
      setInvoiceNoError("Invoice number is required");
      return;
    }
    if (defaultNo && trimmed === defaultNo) {
      setInvoiceNoError(null);
      return;
    }
    setCheckingInvoiceNo(true);
    try {
      const result = await api.invoices.checkInvoiceNo(trimmed, partyKey);
      if (!result.available) {
        setInvoiceNoError(
          `Invoice number "${trimmed}" is already in use.${result.default_invoice_no ? ` Use the default: ${result.default_invoice_no}` : ""}`,
        );
      } else {
        setInvoiceNoError(null);
      }
    } catch {
      setInvoiceNoError(null);
    } finally {
      setCheckingInvoiceNo(false);
    }
  }, []);

  useEffect(() => {
    if (!editing) return;
    if (checkTimerRef.current) clearTimeout(checkTimerRef.current);
    checkTimerRef.current = setTimeout(() => {
      validateInvoiceNo(editing.invoice_no ?? "", editing.party_key, defaultInvoiceNo);
    }, 400);
    return () => {
      if (checkTimerRef.current) clearTimeout(checkTimerRef.current);
    };
  }, [editing?.invoice_no, editing?.party_key, defaultInvoiceNo, validateInvoiceNo]);

  const useDefaultInvoiceNo = () => {
    if (!defaultInvoiceNo || !editing) return;
    setEditField("invoice_no", defaultInvoiceNo);
    setInvoiceNoError(null);
  };

  const downloadPdf = async (party: PartyListItem) => {
    setBusy(`pdf:${party.party_key}`);
    try {
      await api.reports.generate(
        api.invoices.pdfUrl(party.party_key),
        `Invoice_${party.company_name || party.party_key}.pdf`,
      );
      load(); // refresh invoice no + last generated timestamp
    } catch (e: unknown) {
      push("error", e instanceof Error ? e.message : "Generation failed");
    } finally {
      setBusy(null);
    }
  };

  const openHistory = async (party: PartyListItem) => {
    setHistoryParty(party);
    setArchives([]);
    setLoadingArchives(true);
    try {
      setArchives(await api.invoices.listArchives(party.party_key));
    } catch (e: unknown) {
      push("error", e instanceof Error ? e.message : "Failed to load invoice history");
      setHistoryParty(null);
    } finally {
      setLoadingArchives(false);
    }
  };

  const downloadArchive = async (archive: InvoiceArchive) => {
    if (!historyParty) return;
    setBusy(`archive:${archive.id}`);
    try {
      await api.invoices.downloadArchive(historyParty.party_key, archive.id, archive.filename);
    } catch (e: unknown) {
      push("error", e instanceof Error ? e.message : "Download failed");
    } finally {
      setBusy(null);
    }
  };

  const closeHistory = () => {
    setHistoryParty(null);
    setArchives([]);
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

  const addParticular = (nonTax = false) =>
    setEditing((inv) => inv ? {
      ...inv,
      particulars: [...inv.particulars, {
        id: Math.max(0, ...inv.particulars.map((p) => p.id)) + 1,
        description: "", sac_code: nonTax ? "On Actuals" : "997159", amount: 0,
        is_red: false, non_taxable: nonTax, enabled: true,
      }],
    } : inv);

  const removeParticular = (id: number) =>
    setEditing((inv) => inv ? { ...inv, particulars: inv.particulars.filter((p) => p.id !== id) } : inv);

  const setEditField = <K extends keyof Invoice>(k: K, v: Invoice[K]) =>
    setEditing((inv) => inv ? { ...inv, [k]: v } : inv);

  const saveEdit = async () => {
    if (!editing) return;
    if (invoiceNoError) {
      push("error", invoiceNoError);
      return;
    }
    const trimmedNo = (editing.invoice_no ?? "").trim();
    if (!trimmedNo) {
      push("error", "Invoice number is required");
      return;
    }
    setSavingEdit(true);
    try {
      const updated = await api.invoices.updateInvoice(editing.party_key, {
        particulars: editing.particulars,
        gst_type: editing.gst_type,
        igst_rate: editing.igst_rate,
        cgst_rate: editing.cgst_rate,
        sgst_rate: editing.sgst_rate,
        invoice_no: trimmedNo,
        invoice_date: editing.invoice_date || null,
        payment_status: editing.payment_status,
        payment_date: editing.payment_date,
        amount_paid: editing.amount_paid,
      });
      setEditing(null);
      setDefaultInvoiceNo(null);
      setInvoiceNoError(null);
      push("success", `Invoice saved${updated.invoice_no ? ` (${updated.invoice_no})` : ""}`);
      load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Save failed";
      push("error", msg);
      if (msg.includes("already in use") && defaultInvoiceNo) {
        setInvoiceNoError(msg);
      }
    } finally {
      setSavingEdit(false);
    }
  };

  const editUnits = editing?.isin_count || 1;
  const editTotal = editing
    ? computeTotal(editing.particulars, editing.gst_type, editing.igst_rate, editing.cgst_rate, editing.sgst_rate, editUnits)
    : 0;

  return (
    <div>
      {/* ── History modal ── */}
      {historyParty && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)" }} onClick={closeHistory} />
          <div className="card" style={{ position: "relative", zIndex: 1, width: 720, maxWidth: "94vw", maxHeight: "80vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "18px 20px 12px", borderBottom: "1px solid var(--border)" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>Generated Invoices</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                  {historyParty.company_name || historyParty.party_key}
                  {historyParty.invoice_no && <> · {historyParty.invoice_no}</>}
                </div>
              </div>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={closeHistory}><X size={16} /></button>
            </div>
            <div style={{ overflowY: "auto", padding: "0 20px 16px" }}>
              {loadingArchives ? (
                <div className="spinner-center" style={{ padding: 32 }}><span className="spinner" /></div>
              ) : archives.length === 0 ? (
                <div className="empty-state" style={{ padding: "32px 0" }}>
                  <History size={28} />
                  <div>No archived invoices yet</div>
                  <div style={{ fontSize: 12 }}>Use the download button to generate — copies are saved here automatically</div>
                </div>
              ) : (
                <table style={{ width: "100%", marginTop: 12 }}>
                  <thead>
                    <tr>
                      <th>Invoice No</th>
                      <th>Invoice Date</th>
                      <th>Generated</th>
                      <th style={{ textAlign: "right" }}>Total</th>
                      <th style={{ textAlign: "center", width: 80 }}>Download</th>
                    </tr>
                  </thead>
                  <tbody>
                    {archives.map((a) => (
                      <tr key={a.id}>
                        <td><code style={{ fontSize: 12 }}>{a.invoice_no}</code></td>
                        <td style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                          {a.invoice_date
                            ? new Date(a.invoice_date).toLocaleDateString("en-IN")
                            : <span style={{ color: "var(--text-muted)" }}>—</span>}
                        </td>
                        <td style={{ fontSize: 12, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                          {fmtDate(a.generated_at)}
                        </td>
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                          {a.grand_total != null ? inr(a.grand_total) : "—"}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <button
                            className="btn btn-ghost btn-sm btn-icon"
                            title="Download archived PDF"
                            onClick={() => downloadArchive(a)}
                            disabled={!!busy}
                            style={{ color: "var(--accent)" }}
                          >
                            {busy === `archive:${a.id}` ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <Download size={14} />}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Editor modal ── */}
      {editing && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)" }} onClick={() => { setEditing(null); setDefaultInvoiceNo(null); setInvoiceNoError(null); }} />
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
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => { setEditing(null); setDefaultInvoiceNo(null); setInvoiceNoError(null); }}><X size={16} /></button>
            </div>

            {editing.isins.length > 0 && (
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 12, lineHeight: 1.5 }}>
                <b>ISINs:</b> {editing.isins.join(", ")}
              </div>
            )}

            {/* Invoice date + number */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 14, padding: "12px 14px", background: "var(--bg)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-muted)" }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Invoice Date</label>
                <input
                  className="input input-sm"
                  type="date"
                  value={editing.invoice_date?.slice(0, 10) ?? ""}
                  onChange={(e) => setEditField("invoice_date", e.target.value || null)}
                />
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>
                  Overrides the date from the particulars template for this party only
                </div>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Invoice Number</label>
                <input
                  className="input input-sm"
                  value={editing.invoice_no ?? ""}
                  onChange={(e) => setEditField("invoice_no", e.target.value)}
                  style={invoiceNoError ? { borderColor: "var(--danger)" } : undefined}
                />
                {defaultInvoiceNo && (
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>
                    Default: <code style={{ fontSize: 11 }}>{defaultInvoiceNo}</code>
                    {editing.invoice_no !== defaultInvoiceNo && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ marginLeft: 8, padding: "0 6px", height: 22, fontSize: 11 }}
                        onClick={useDefaultInvoiceNo}
                      >
                        Use default
                      </button>
                    )}
                  </div>
                )}
                {checkingInvoiceNo && (
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>Checking availability…</div>
                )}
                {invoiceNoError && !checkingInvoiceNo && (
                  <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 3, display: "flex", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
                    <span>{invoiceNoError}</span>
                    {defaultInvoiceNo && editing.invoice_no !== defaultInvoiceNo && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ padding: "0 6px", height: 22, fontSize: 11, color: "var(--danger)" }}
                        onClick={useDefaultInvoiceNo}
                      >
                        Use default
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Particulars */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
              <div style={{ fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--text-muted)" }}>Particulars</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Taxable × <b>{editUnits}</b> ISIN unit(s); non-taxable are flat</div>
            </div>
            {(["A", "B"] as const).map((section) => {
              const isB = section === "B";
              const rowsInSection = editing.particulars.filter((p) => !!p.non_taxable === isB);
              return (
                <div key={section} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: isB ? "#2563eb" : "var(--accent)", margin: "4px 0 2px" }}>
                    {isB ? "B — Non-Taxable (Actual Expenses / Out-of-Pocket)" : "A — Taxable (GST charged, per ISIN)"}
                  </div>
                  {rowsInSection.map((item) => (
                    <div key={item.id} style={{ display: "grid", gridTemplateColumns: "1fr 120px 110px auto auto", gap: 8, alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--border-muted)" }}>
                      <input className="input input-sm" placeholder="Description" value={item.description}
                        onChange={(e) => patchParticular(item.id, { description: e.target.value })} />
                      <input className="input input-sm" placeholder={isB ? "On Actuals" : "SAC Code"} value={item.sac_code}
                        onChange={(e) => patchParticular(item.id, { sac_code: e.target.value })} />
                      <div style={{ position: "relative" }}>
                        <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "var(--text-muted)" }}>₹</span>
                        <input className="input input-sm" type="number" min="0" value={item.amount} style={{ paddingLeft: 22 }}
                          onChange={(e) => patchParticular(item.id, { amount: Number(e.target.value) })} />
                      </div>
                      <label title="Include in invoice" style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: item.enabled ? "var(--accent)" : "var(--text-muted)", cursor: "pointer" }}>
                        <input type="checkbox" checked={item.enabled} onChange={(e) => patchParticular(item.id, { enabled: e.target.checked })} style={{ accentColor: "var(--accent)" }} /> {item.enabled ? "On" : "Off"}
                      </label>
                      <button className="btn btn-ghost btn-sm btn-icon" onClick={() => removeParticular(item.id)} style={{ color: "var(--danger)" }}><Trash2 size={13} /></button>
                    </div>
                  ))}
                  <button className="btn btn-ghost btn-sm" style={{ marginTop: 4 }} onClick={() => addParticular(isB)}>
                    <Plus size={13} /> Add {isB ? "non-taxable" : "taxable"} particular
                  </button>
                </div>
              );
            })}

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
                <button className="btn btn-secondary btn-sm" onClick={() => { setEditing(null); setDefaultInvoiceNo(null); setInvoiceNoError(null); }}>Cancel</button>
                <button className="btn btn-primary btn-sm" onClick={saveEdit} disabled={savingEdit || !!invoiceNoError || checkingInvoiceNo || !can("editor")}>
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
                <th style={{ textAlign: "center" }}>ISIN Units</th>
                <th>Invoice No</th>
                <th>Last Generated</th>
                <th style={{ textAlign: "right" }}>Grand Total</th>
                <th style={{ textAlign: "center" }}>Payment</th>
                <th style={{ textAlign: "center" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8}><div className="spinner-center"><span className="spinner" /></div></td></tr>
              ) : parties.length === 0 ? (
                <tr><td colSpan={8}>
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
                  <td style={{ textAlign: "center", fontVariantNumeric: "tabular-nums" }}
                    title={p.isin_count !== p.isins.length ? `${p.isins.length} ISIN(s); some active in both NSDL & CDSL count twice` : `${p.isins.length} ISIN(s)`}>
                    {p.isin_count}
                  </td>
                  <td style={{ fontSize: 12 }}>{p.invoice_no ?? <span style={{ color: "var(--text-muted)" }}>—</span>}</td>
                  <td style={{ fontSize: 12, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                    {fmtDate(p.last_generated_at) ?? <span style={{ color: "var(--text-muted)" }}>Never</span>}
                  </td>
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
                    <button className="btn btn-ghost btn-sm btn-icon" title="View generated invoices"
                      onClick={() => openHistory(p)} disabled={!!busy}>
                      {busy === `history:${p.party_key}` ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <History size={14} />}
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
