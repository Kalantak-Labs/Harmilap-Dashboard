"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search, Settings, LayoutList, X, Plus, Trash2, Check, Download, Receipt, Upload,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/Toast";
import type {
  PartyBillingItem, PartyBillingSettings, PartyBillingSummary,
  Particular, BillingInvoiceRecord,
} from "@/lib/types";
import { ColumnFilter } from "@/components/ui/ColumnFilter";
import { filtersToParam, type ColFilters } from "@/lib/filters";

const inr = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const fyOf = (iso: string) => {
  const d = new Date(iso);
  const y = d.getFullYear();
  return d.getMonth() >= 3 ? `${y}-${String(y + 1).slice(2)}` : `${y - 1}-${String(y).slice(2)}`;
};
type YearRow = { fiscal_year: string; isin_count: number | "" };

function ParticularsEditor({
  particulars, isinCount, onChange,
}: {
  particulars: Particular[];
  isinCount: number;
  onChange: (p: Particular[]) => void;
}) {
  const patch = (id: number, p: Partial<Particular>) =>
    onChange(particulars.map((it) => (it.id === id ? { ...it, ...p } : it)));
  const remove = (id: number) => onChange(particulars.filter((p) => p.id !== id));
  const add = (nonTax = false) => {
    const newId = Math.max(0, ...particulars.map((p) => p.id)) + 1;
    onChange([...particulars, {
      id: newId, description: "", sac_code: nonTax ? "On Actuals" : "997159",
      amount: 0, is_red: false, non_taxable: nonTax, enabled: true,
    }]);
  };

  const renderSection = (title: string, items: Particular[], nonTax: boolean) => (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>{title}</div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => add(nonTax)}>
          <Plus size={12} /> Add
        </button>
      </div>
      {items.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>No items</div>
      ) : items.map((p) => (
        <div key={p.id} style={{ display: "grid", gridTemplateColumns: "24px 1fr 100px 90px 32px", gap: 8, marginBottom: 6, alignItems: "center" }}>
          <input type="checkbox" checked={p.enabled} onChange={(e) => patch(p.id, { enabled: e.target.checked })} />
          <input className="input input-sm" value={p.description} placeholder="Description"
            onChange={(e) => patch(p.id, { description: e.target.value })} />
          <input className="input input-sm" type="number" min="0" value={p.amount || ""} placeholder="Amount"
            onChange={(e) => patch(p.id, { amount: Number(e.target.value) || 0 })} />
          <input className="input input-sm" value={p.sac_code} placeholder="SAC"
            onChange={(e) => patch(p.id, { sac_code: e.target.value })} />
          <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => remove(p.id)}><Trash2 size={12} /></button>
        </div>
      ))}
      {!nonTax && isinCount > 1 && (
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
          Taxable amounts are per ISIN (× {isinCount} units)
        </div>
      )}
    </div>
  );

  const taxable = particulars.filter((p) => !p.non_taxable);
  const nonTaxable = particulars.filter((p) => p.non_taxable);
  return (
    <>
      {renderSection("Taxable (A)", taxable, false)}
      {renderSection("Non-Taxable (B)", nonTaxable, true)}
    </>
  );
}

export default function BillingsPage() {
  const { can } = useAuth();
  const { push } = useToast();
  const router = useRouter();
  const [parties, setParties] = useState<PartyBillingItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [colFilters, setColFilters] = useState<ColFilters>({});
  const [skip, setSkip] = useState(0);

  const setCol = (key: string, val: string) => { setColFilters((p) => ({ ...p, [key]: val })); setSkip(0); };
  const colF = (key: string, label: string) => (
    <ColumnFilter label={label} value={colFilters[key] ?? ""} onChange={(v) => setCol(key, v)} />
  );
  const limit = 50;
  const [busy, setBusy] = useState<string | null>(null);

  const [settingsParty, setSettingsParty] = useState<PartyBillingItem | null>(null);
  const [settings, setSettings] = useState<PartyBillingSettings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  const [summaryParty, setSummaryParty] = useState<PartyBillingItem | null>(null);
  const [summary, setSummary] = useState<PartyBillingSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [yearRows, setYearRows] = useState<YearRow[]>([]);
  const [invoiceNoError, setInvoiceNoError] = useState<string | null>(null);
  const [defaultInvoiceNo, setDefaultInvoiceNo] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [payAmount, setPayAmount] = useState("");
  const [payBank, setPayBank] = useState<"HDFC" | "IDFC">("HDFC");
  const [payRef, setPayRef] = useState("");
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [recordingPay, setRecordingPay] = useState(false);

  const [manualNo, setManualNo] = useState("");
  const [manualDate, setManualDate] = useState(new Date().toISOString().slice(0, 10));
  const [manualAmount, setManualAmount] = useState("");
  const [manualGeneratedOn, setManualGeneratedOn] = useState(new Date().toISOString().slice(0, 10));
  const [manualPdf, setManualPdf] = useState<File | null>(null);
  const [manualNoError, setManualNoError] = useState<string | null>(null);
  const [addingManual, setAddingManual] = useState(false);
  const manualFileRef = useRef<HTMLInputElement>(null);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.billings.listParties({
        search: search || undefined,
        filters: filtersToParam(colFilters),
        skip,
        limit,
      });
      setParties(res.items);
      setTotal(res.total);
    } catch (e: unknown) {
      push("error", e instanceof Error ? e.message : "Failed to load billings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, JSON.stringify(colFilters), skip]);

  const totalPages = Math.ceil(total / limit);
  const page = Math.floor(skip / limit);

  const openSettings = async (party: PartyBillingItem) => {
    setBusy(`settings:${party.party_key}`);
    try {
      setSettingsParty(party);
      setSettings(await api.billings.getSettings(party.party_key));
    } catch (e: unknown) {
      push("error", e instanceof Error ? e.message : "Failed to load settings");
      setSettingsParty(null);
    } finally {
      setBusy(null);
    }
  };

  const saveSettings = async () => {
    if (!settings || !settingsParty) return;
    setSavingSettings(true);
    try {
      const updated = await api.billings.updateSettings(settingsParty.party_key, {
        particulars: settings.particulars,
      });
      setSettings(updated);
      push("success", "Billing settings saved");
      load();
    } catch (e: unknown) {
      push("error", e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingSettings(false);
    }
  };

  const refreshSummary = useCallback(async (partyKey: string) => {
    const data = await api.billings.getSummary(partyKey);
    setSummary(data);
    return data;
  }, []);

  const openSummary = async (party: PartyBillingItem) => {
    setSummaryParty(party);
    setSummary(null);
    setLoadingSummary(true);
    setInvoiceNo("");
    setInvoiceNoError(null);
    setDefaultInvoiceNo(null);
    setYearRows([{ fiscal_year: fyOf(invoiceDate), isin_count: party.isin_count || 1 }]);
    setPayAmount("");
    setPayRef("");
    setManualNo("");
    setManualDate(new Date().toISOString().slice(0, 10));
    setManualAmount("");
    setManualGeneratedOn(new Date().toISOString().slice(0, 10));
    setManualPdf(null);
    setManualNoError(null);
    setDeleteConfirmId(null);
    if (manualFileRef.current) manualFileRef.current.value = "";
    try {
      const data = await refreshSummary(party.party_key);
      const defaultNo = await api.billings.checkInvoiceNo("", party.party_key, invoiceDate);
      setDefaultInvoiceNo(defaultNo.default_invoice_no);
      setInvoiceNo(defaultNo.default_invoice_no || "");
    } catch (e: unknown) {
      push("error", e instanceof Error ? e.message : "Failed to load summary");
      setSummaryParty(null);
    } finally {
      setLoadingSummary(false);
    }
  };

  const validateInvoiceNo = useCallback(async (no: string, partyKey: string, date: string) => {
    const trimmed = no.trim();
    if (!trimmed) { setInvoiceNoError("Invoice number is required"); return; }
    try {
      const result = await api.billings.checkInvoiceNo(trimmed, partyKey, date);
      if (!result.available) {
        setInvoiceNoError(`Invoice number "${trimmed}" is already in use.${result.default_invoice_no ? ` Suggested: ${result.default_invoice_no}` : ""}`);
      } else {
        setInvoiceNoError(null);
      }
      if (result.default_invoice_no) setDefaultInvoiceNo(result.default_invoice_no);
    } catch {
      setInvoiceNoError(null);
    }
  }, []);

  useEffect(() => {
    if (!summaryParty || loadingSummary) return;
    if (checkTimer.current) clearTimeout(checkTimer.current);
    checkTimer.current = setTimeout(() => {
      validateInvoiceNo(invoiceNo, summaryParty.party_key, invoiceDate);
    }, 400);
    return () => { if (checkTimer.current) clearTimeout(checkTimer.current); };
  }, [invoiceNo, invoiceDate, summaryParty, loadingSummary, validateInvoiceNo]);

  useEffect(() => {
    if (!summaryParty || loadingSummary) return;
    api.billings.checkInvoiceNo("", summaryParty.party_key, invoiceDate)
      .then((r) => {
        setDefaultInvoiceNo(r.default_invoice_no);
        if (!invoiceNo.trim() && r.default_invoice_no) setInvoiceNo(r.default_invoice_no);
      })
      .catch(() => {});
  }, [invoiceDate, summaryParty?.party_key, loadingSummary]);

  const validateManualNo = useCallback(async (no: string, partyKey: string, date: string) => {
    const trimmed = no.trim();
    if (!trimmed) { setManualNoError("Invoice number is required"); return; }
    try {
      const result = await api.billings.checkInvoiceNo(trimmed, partyKey, date);
      if (!result.available) {
        setManualNoError(`Invoice number "${trimmed}" is already in use.`);
      } else {
        setManualNoError(null);
      }
    } catch {
      setManualNoError(null);
    }
  }, []);

  useEffect(() => {
    if (!summaryParty || loadingSummary) return;
    const t = setTimeout(() => {
      validateManualNo(manualNo, summaryParty.party_key, manualDate);
    }, 400);
    return () => clearTimeout(t);
  }, [manualNo, manualDate, summaryParty, loadingSummary, validateManualNo]);

  const setYearField = (i: number, patch: Partial<YearRow>) =>
    setYearRows((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addYearRow = () =>
    setYearRows((rows) => [...rows, { fiscal_year: "", isin_count: 1 }]);
  const removeYearRow = (i: number) =>
    setYearRows((rows) => rows.filter((_, j) => j !== i));

  const generateInvoice = async () => {
    if (!summaryParty || invoiceNoError) return;
    const trimmed = invoiceNo.trim();
    if (!trimmed) { push("error", "Invoice number is required"); return; }
    const years = yearRows
      .filter((r) => r.fiscal_year.trim() && r.isin_count !== "" && Number(r.isin_count) > 0)
      .map((r) => ({ fiscal_year: r.fiscal_year.trim(), isin_count: Number(r.isin_count) }));
    if (years.length === 0) { push("error", "Add at least one financial year with an ISIN count"); return; }
    setGenerating(true);
    try {
      await api.billings.generateInvoice(summaryParty.party_key, {
        invoice_no: trimmed,
        invoice_date: invoiceDate,
        year_isins: years,
      });
      push("success", `Invoice ${trimmed} generated`);
      const data = await refreshSummary(summaryParty.party_key);
      const next = await api.billings.checkInvoiceNo("", summaryParty.party_key, invoiceDate);
      setDefaultInvoiceNo(next.default_invoice_no);
      setInvoiceNo(next.default_invoice_no || "");
      setInvoiceNoError(null);
      load();
    } catch (e: unknown) {
      push("error", e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const downloadInvoice = async (inv: BillingInvoiceRecord) => {
    setBusy(`dl:${inv.id}`);
    try {
      await api.billings.downloadInvoice(inv.id, inv.filename);
    } catch (e: unknown) {
      push("error", e instanceof Error ? e.message : "Download failed");
    } finally {
      setBusy(null);
    }
  };

  const deleteInvoice = async (inv: BillingInvoiceRecord) => {
    if (!summaryParty) return;
    setBusy(`del:${inv.id}`);
    try {
      await api.billings.deleteInvoice(inv.id);
      push("success", `Invoice ${inv.invoice_no} deleted`);
      setDeleteConfirmId(null);
      await refreshSummary(summaryParty.party_key);
      load();
    } catch (e: unknown) {
      push("error", e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(null);
    }
  };

  const addManualInvoice = async () => {
    if (!summaryParty || manualNoError) return;
    const trimmed = manualNo.trim();
    const amount = Number(manualAmount);
    if (!trimmed) { push("error", "Invoice number is required"); return; }
    if (!amount || amount <= 0) { push("error", "Enter a valid amount"); return; }
    if (!manualPdf) { push("error", "PDF file is required"); return; }
    setAddingManual(true);
    try {
      await api.billings.addManualInvoice(summaryParty.party_key, {
        invoice_no: trimmed,
        invoice_date: manualDate,
        amount,
        generated_on: manualGeneratedOn,
        file: manualPdf,
      });
      push("success", `Manual bill ${trimmed} added`);
      setManualNo("");
      setManualAmount("");
      setManualPdf(null);
      setManualNoError(null);
      if (manualFileRef.current) manualFileRef.current.value = "";
      await refreshSummary(summaryParty.party_key);
      load();
    } catch (e: unknown) {
      push("error", e instanceof Error ? e.message : "Failed to add manual bill");
    } finally {
      setAddingManual(false);
    }
  };

  const recordPayment = async () => {
    if (!summaryParty || !summary) return;
    const amount = Number(payAmount);
    if (!amount || amount <= 0) { push("error", "Enter a valid payment amount"); return; }
    if (!payRef.trim()) { push("error", "Reference number is required"); return; }
    if (amount > summary.outstanding + 0.01) {
      push("error", `Amount exceeds outstanding (${inr(summary.outstanding)})`);
      return;
    }
    setRecordingPay(true);
    try {
      await api.billings.recordPayment(summaryParty.party_key, {
        amount,
        receiving_bank: payBank,
        reference_number: payRef.trim(),
        received_at: payDate,
      });
      push("success", "Payment recorded");
      setPayAmount("");
      setPayRef("");
      await refreshSummary(summaryParty.party_key);
      load();
    } catch (e: unknown) {
      push("error", e instanceof Error ? e.message : "Failed to record payment");
    } finally {
      setRecordingPay(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Billings</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 4 }}>
            Generate invoices, track payments, and manage billing per company
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {can("can_download") && (
            <button className="btn btn-secondary" onClick={async () => {
              try { await api.billings.exportInvoices(filtersToParam(colFilters)); } catch (e: unknown) { push("error", e instanceof Error ? e.message : "Export failed"); }
            }}>
              <Download size={14} /> Export Invoices
            </button>
          )}
          {can("editor") && (
            <button className="btn btn-secondary" onClick={() => router.push("/dashboard/billings/template")}>
              <Receipt size={14} /> Global Template
            </button>
          )}
        </div>
      </div>

      <div className="card" style={{ padding: 14, marginBottom: 14 }}>
        <div style={{ position: "relative", maxWidth: 360 }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input className="input" style={{ paddingLeft: 32 }} placeholder="Search company or RTA code…"
            value={search} onChange={(e) => { setSearch(e.target.value); setSkip(0); }} />
        </div>
        {!loading && (
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
            {total.toLocaleString()} {total === 1 ? "company" : "companies"}
          </div>
        )}
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        {loading ? (
          <div className="spinner-center" style={{ padding: 40 }}><span className="spinner spinner-lg" /></div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Company{colF("company_name", "Company")}</th>
                <th>RTA Codes{colF("rta_code", "RTA Code")}</th>
                <th>ISIN Units</th>
                <th>Total Billed</th>
                <th>Outstanding</th>
                <th style={{ width: 100 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {parties.map((p) => (
                <tr key={p.party_key}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{p.company_name || "—"}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{p.party_key}</div>
                  </td>
                  <td style={{ fontSize: 12 }}>
                    {p.nsdl_rta_code && <div>NSDL: {p.nsdl_rta_code}</div>}
                    {p.cdsl_rta_code && <div>CDSL: {p.cdsl_rta_code}</div>}
                  </td>
                  <td>{p.isin_count}</td>
                  <td><span style={{ fontWeight: 600, color: "#2563eb" }}>{inr(p.total_billed)}</span></td>
                  <td>
                    <span style={{ fontWeight: 600, color: p.outstanding > 0 ? "#dc2626" : "#16a34a" }}>
                      {inr(p.outstanding)}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      {can("editor") && (
                        <button className="btn btn-ghost btn-icon btn-sm" title="Billing settings"
                          disabled={busy === `settings:${p.party_key}`}
                          onClick={() => openSettings(p)}>
                          {busy === `settings:${p.party_key}` ? <span className="spinner" /> : <Settings size={14} />}
                        </button>
                      )}
                      <button className="btn btn-ghost btn-icon btn-sm" title="Billing summary"
                        onClick={() => openSummary(p)}>
                        <LayoutList size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && totalPages > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderTop: "1px solid var(--border)", fontSize: 13, color: "var(--text-secondary)" }}>
            <span>Page {page + 1} of {totalPages}</span>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setSkip(Math.max(0, skip - limit))} disabled={skip === 0}>Previous</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setSkip(skip + limit)} disabled={page >= totalPages - 1}>Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Settings modal */}
      {settingsParty && settings && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)" }}
            onClick={() => { setSettingsParty(null); setSettings(null); }} />
          <div className="card" style={{ position: "relative", zIndex: 1, width: 720, maxWidth: "94vw", maxHeight: "85vh", overflow: "auto", padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 700 }}>Billing Settings</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {settingsParty.company_name || settingsParty.party_key} — particulars &amp; prices only
                </div>
              </div>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => { setSettingsParty(null); setSettings(null); }}>
                <X size={16} />
              </button>
            </div>
            <ParticularsEditor
              particulars={settings.particulars}
              isinCount={settings.isin_count}
              onChange={(p) => setSettings((s) => s ? { ...s, particulars: p } : s)}
            />
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
              Preview total (incl. GST): {inr(settings.preview_total)}
            </div>
            {can("editor") && (
              <button className="btn btn-primary" onClick={saveSettings} disabled={savingSettings}>
                {savingSettings ? <span className="spinner" /> : <Check size={14} />} Save Settings
              </button>
            )}
          </div>
        </div>
      )}

      {/* Summary modal */}
      {summaryParty && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)" }}
            onClick={() => { setSummaryParty(null); setSummary(null); }} />
          <div className="card" style={{ position: "relative", zIndex: 1, width: 860, maxWidth: "96vw", maxHeight: "90vh", overflow: "auto", padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 17 }}>Billing Summary</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{summaryParty.company_name || summaryParty.party_key}</div>
              </div>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => { setSummaryParty(null); setSummary(null); }}>
                <X size={16} />
              </button>
            </div>

            {loadingSummary || !summary ? (
              <div className="spinner-center" style={{ padding: 32 }}><span className="spinner" /></div>
            ) : (
              <>
                <div className="stat-grid" style={{ marginBottom: 20, gridTemplateColumns: "repeat(3, 1fr)" }}>
                  <div className="stat-card" style={{ borderLeft: "3px solid #2563eb" }}>
                    <div className="stat-card-label">Total Billed</div>
                    <div className="stat-card-value" style={{ color: "#2563eb" }}>{inr(summary.total_billed)}</div>
                  </div>
                  <div className="stat-card" style={{ borderLeft: "3px solid #16a34a" }}>
                    <div className="stat-card-label">Total Received</div>
                    <div className="stat-card-value" style={{ color: "#16a34a" }}>{inr(summary.total_received)}</div>
                  </div>
                  <div className="stat-card" style={{ borderLeft: `3px solid ${summary.outstanding > 0 ? "#dc2626" : "#16a34a"}` }}>
                    <div className="stat-card-label">Outstanding</div>
                    <div className="stat-card-value" style={{ color: summary.outstanding > 0 ? "#dc2626" : "#16a34a" }}>
                      {inr(summary.outstanding)}
                    </div>
                  </div>
                </div>

                {can("editor") && (
                  <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 14, marginBottom: 20 }}>
                    <div style={{ fontWeight: 600, marginBottom: 10 }}>Generate New Invoice</div>
                    <div className="grid-2" style={{ marginBottom: 10 }}>
                      <div className="form-group">
                        <label className="form-label">Invoice Date</label>
                        <input className="input" type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Invoice Number</label>
                        <input className="input" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)}
                          style={invoiceNoError ? { borderColor: "var(--danger)" } : undefined} />
                        {defaultInvoiceNo && (
                          <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 4, fontSize: 11 }}
                            onClick={() => { setInvoiceNo(defaultInvoiceNo); setInvoiceNoError(null); }}>
                            Use default ({defaultInvoiceNo})
                          </button>
                        )}
                        {invoiceNoError && <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 4 }}>{invoiceNoError}</div>}
                      </div>
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <label className="form-label" style={{ margin: 0 }}>Year-wise pending ISINs</label>
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Total active: <b>{summaryParty.isin_count}</b></span>
                      </div>
                      {yearRows.map((r, i) => (
                        <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 120px 32px", gap: 8, marginBottom: 6, alignItems: "center" }}>
                          <input className="input input-sm" placeholder="Financial year (e.g. 2025-26)" value={r.fiscal_year}
                            onChange={(e) => setYearField(i, { fiscal_year: e.target.value })} />
                          <input className="input input-sm" type="number" min={1} placeholder="ISINs" value={r.isin_count}
                            onChange={(e) => setYearField(i, { isin_count: e.target.value === "" ? "" : Math.max(1, Number(e.target.value)) })} />
                          <button type="button" className="btn btn-ghost btn-icon btn-sm" disabled={yearRows.length === 1}
                            onClick={() => removeYearRow(i)} style={{ color: "var(--danger)" }}><Trash2 size={12} /></button>
                        </div>
                      ))}
                      <button type="button" className="btn btn-secondary btn-sm" onClick={addYearRow}><Plus size={12} /> Add year</button>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
                        One invoice covers all years; each year&apos;s amount = per-ISIN charge × its ISIN count.
                      </div>
                    </div>
                    <button className="btn btn-primary" onClick={generateInvoice}
                      disabled={generating || !!invoiceNoError}>
                      {generating ? <span className="spinner" /> : <Receipt size={14} />} Generate Invoice
                    </button>
                  </div>
                )}

                {can("editor") && (
                  <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 14, marginBottom: 20 }}>
                    <div style={{ fontWeight: 600, marginBottom: 10 }}>Add Manual Bill</div>
                    <div className="grid-2" style={{ marginBottom: 10 }}>
                      <div className="form-group">
                        <label className="form-label">Invoice Number</label>
                        <input className="input" value={manualNo} onChange={(e) => setManualNo(e.target.value)}
                          style={manualNoError ? { borderColor: "var(--danger)" } : undefined} />
                        {manualNoError && <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 4 }}>{manualNoError}</div>}
                      </div>
                      <div className="form-group">
                        <label className="form-label">Invoice Date</label>
                        <input className="input" type="date" value={manualDate} onChange={(e) => setManualDate(e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Amount</label>
                        <input className="input" type="number" min="0" step="0.01" value={manualAmount}
                          onChange={(e) => setManualAmount(e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Generated On</label>
                        <input className="input" type="date" value={manualGeneratedOn}
                          onChange={(e) => setManualGeneratedOn(e.target.value)} />
                      </div>
                    </div>
                    <div className="form-group" style={{ marginBottom: 10 }}>
                      <label className="form-label">Invoice PDF</label>
                      <input ref={manualFileRef} className="input" type="file" accept="application/pdf,.pdf"
                        onChange={(e) => setManualPdf(e.target.files?.[0] ?? null)} />
                    </div>
                    <button className="btn btn-secondary" onClick={addManualInvoice}
                      disabled={addingManual || !!manualNoError || !manualPdf}>
                      {addingManual ? <span className="spinner" /> : <Upload size={14} />} Add Manual Bill
                    </button>
                  </div>
                )}

                <div style={{ fontWeight: 600, marginBottom: 8 }}>Invoice History</div>
                {summary.invoices.length === 0 ? (
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>No invoices generated yet</div>
                ) : (
                  <table className="table" style={{ marginBottom: 20 }}>
                    <thead>
                      <tr>
                        <th>Invoice No</th>
                        <th>Date</th>
                        <th>Amount</th>
                        <th>Generated</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {summary.invoices.map((inv) => (
                        <tr key={inv.id}>
                          <td>
                            {inv.invoice_no}
                            {inv.is_manual && (
                              <span className="badge badge-gray" style={{ marginLeft: 6, fontSize: 10 }}>Manual</span>
                            )}
                          </td>
                          <td>{fmtDate(inv.invoice_date)}</td>
                          <td>{inr(inv.grand_total)}</td>
                          <td style={{ fontSize: 12 }}>{fmtDate(inv.generated_at)}</td>
                          <td>
                            <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                              <button className="btn btn-ghost btn-icon btn-sm" title="Redownload"
                                disabled={busy === `dl:${inv.id}`}
                                onClick={() => downloadInvoice(inv)}>
                                {busy === `dl:${inv.id}` ? <span className="spinner" /> : <Download size={14} />}
                              </button>
                              {can("editor") && (
                                deleteConfirmId === inv.id ? (
                                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                                    <button className="btn btn-danger btn-sm" style={{ fontSize: 11 }}
                                      disabled={busy === `del:${inv.id}`}
                                      onClick={() => deleteInvoice(inv)}>
                                      {busy === `del:${inv.id}` ? <span className="spinner" /> : "Confirm"}
                                    </button>
                                    <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}
                                      onClick={() => setDeleteConfirmId(null)}>Cancel</button>
                                  </div>
                                ) : (
                                  <button className="btn btn-ghost btn-icon btn-sm" title="Delete invoice"
                                    onClick={() => setDeleteConfirmId(inv.id)}>
                                    <Trash2 size={14} />
                                  </button>
                                )
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {can("editor") && summary.outstanding > 0 && (
                  <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 14, marginBottom: 20 }}>
                    <div style={{ fontWeight: 600, marginBottom: 10 }}>Record Payment Received</div>
                    <div className="grid-2">
                      <div className="form-group">
                        <label className="form-label">Amount (max {inr(summary.outstanding)})</label>
                        <input className="input" type="number" min="0" step="0.01" value={payAmount}
                          onChange={(e) => setPayAmount(e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Receiving Bank</label>
                        <select className="input" value={payBank} onChange={(e) => setPayBank(e.target.value as "HDFC" | "IDFC")}>
                          <option value="HDFC">HDFC Bank</option>
                          <option value="IDFC">IDFC Bank</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Reference Number</label>
                        <input className="input" value={payRef} onChange={(e) => setPayRef(e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Payment Date</label>
                        <input className="input" type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
                      </div>
                    </div>
                    <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={recordPayment} disabled={recordingPay}>
                      {recordingPay ? <span className="spinner" /> : <Check size={14} />} Record Payment
                    </button>
                  </div>
                )}

                <div style={{ fontWeight: 600, marginBottom: 8 }}>Payment History</div>
                {summary.payments.length === 0 ? (
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>No payments recorded</div>
                ) : (
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Amount</th>
                        <th>Bank</th>
                        <th>Reference</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.payments.map((pay) => (
                        <tr key={pay.id}>
                          <td>{fmtDate(pay.received_at)}</td>
                          <td>{inr(pay.amount)}</td>
                          <td>{pay.receiving_bank}</td>
                          <td>{pay.reference_number}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
