"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2, Check } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/Toast";
import type { InvoiceConfig, InvoiceLineItem, BankAccount } from "@/lib/types";

export default function BillingTemplatePage() {
  const { can } = useAuth();
  const { push } = useToast();
  const router = useRouter();
  const [config, setConfig] = useState<InvoiceConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.billings.getConfig()
      .then((c) => setConfig({ ...c, bank_accounts: c.bank_accounts ?? [] }))
      .catch(() => push("error", "Failed to load billing template"))
      .finally(() => setLoading(false));
  }, []);

  const setBanks = (banks: BankAccount[]) =>
    setConfig((c) => c ? { ...c, bank_accounts: banks } : c);
  const addBank = () =>
    setBanks([...(config!.bank_accounts ?? []), { title: "", details: [{ label: "", value: "" }] }]);
  const removeBank = (bi: number) =>
    setBanks(config!.bank_accounts.filter((_, i) => i !== bi));
  const setBankTitle = (bi: number, title: string) =>
    setBanks(config!.bank_accounts.map((b, i) => i === bi ? { ...b, title } : b));
  const setBankDetail = (bi: number, di: number, patch: Partial<{ label: string; value: string }>) =>
    setBanks(config!.bank_accounts.map((b, i) => i === bi
      ? { ...b, details: b.details.map((d, j) => j === di ? { ...d, ...patch } : d) } : b));
  const addBankDetail = (bi: number) =>
    setBanks(config!.bank_accounts.map((b, i) => i === bi
      ? { ...b, details: [...b.details, { label: "", value: "" }] } : b));
  const removeBankDetail = (bi: number, di: number) =>
    setBanks(config!.bank_accounts.map((b, i) => i === bi
      ? { ...b, details: b.details.filter((_, j) => j !== di) } : b));

  const setItems = (items: InvoiceLineItem[]) =>
    setConfig((c) => c ? { ...c, line_items: items } : c);

  const setField = <K extends keyof InvoiceConfig>(k: K, v: InvoiceConfig[K]) =>
    setConfig((c) => c ? { ...c, [k]: v } : c);

  const updateItem = (id: number, patch: Partial<InvoiceLineItem>) =>
    setItems(config!.line_items.map((it) => it.id === id ? { ...it, ...patch } : it));

  const removeItem = (id: number) =>
    setItems(config!.line_items.filter((it) => it.id !== id));

  const addItem = (nonTax = false) => {
    const newId = Math.max(0, ...config!.line_items.map((it) => it.id)) + 1;
    setItems([...config!.line_items, {
      id: newId, description: "", sac_code: nonTax ? "On Actuals" : "997159",
      amount: 0, is_red: false, non_taxable: nonTax, enabled: true,
    }]);
  };

  const save = async () => {
    if (!config || !can("editor")) return;
    setSaving(true);
    try {
      await api.billings.updateConfig(config);
      push("success", "Global billing template saved");
    } catch (e: unknown) {
      push("error", e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="spinner-center"><span className="spinner spinner-lg" /></div>;
  if (!config) return null;

  const taxable = config.line_items
    .filter((it) => it.enabled && !it.non_taxable)
    .reduce((s, it) => s + it.amount, 0);
  const nonTaxable = config.line_items
    .filter((it) => it.enabled && it.non_taxable)
    .reduce((s, it) => s + it.amount, 0);
  const gstAmt = config.gst_type === "IGST"
    ? taxable * config.igst_rate / 100
    : taxable * (config.cgst_rate + config.sgst_rate) / 100;
  const grand = taxable + nonTaxable + gstAmt;

  return (
    <div>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => router.push("/dashboard/billings")}>
            <ArrowLeft size={16} />
          </button>
          <div>
            <h2>Global Billing Template</h2>
            <div style={{ color: "var(--text-secondary)", fontSize: 12, marginTop: 1 }}>
              Default particulars, GST rates, and bank details. Companies can override particulars and prices only.
            </div>
          </div>
        </div>
        {can("editor") && (
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? <span className="spinner" /> : <Check size={14} />} Save Template
          </button>
        )}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", fontWeight: 600, fontSize: 13, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Particulars</span>
          <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>
            Use <code>{"{fy}"}</code>, <code>{"{prev_fy}"}</code>, <code>{"{prev2_fy}"}</code> in descriptions
          </div>
        </div>
        <div style={{ padding: "4px 18px 12px" }}>
          {(["A", "B"] as const).map((section) => {
            const isB = section === "B";
            const sectionItems = config.line_items.filter((it) => !!it.non_taxable === isB);
            return (
              <div key={section} style={{ marginTop: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: isB ? "#2563eb" : "var(--accent)", marginBottom: 4 }}>
                  {isB ? "B — Non-Taxable (Actual Expenses / Out-of-Pocket)" : "A — Taxable (GST charged, per ISIN)"}
                </div>
                {sectionItems.map((item) => (
                  <div key={item.id} style={{ display: "grid", gridTemplateColumns: "1fr 130px 110px auto auto auto", gap: 8, alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border-muted)" }}>
                    <input
                      className="input input-sm"
                      placeholder="Description (supports {fy} etc.)"
                      value={item.description}
                      disabled={!can("editor")}
                      onChange={(e) => updateItem(item.id, { description: e.target.value })}
                    />
                    <input
                      className="input input-sm"
                      placeholder={isB ? "On Actuals" : "SAC Code"}
                      value={item.sac_code}
                      disabled={!can("editor")}
                      onChange={(e) => updateItem(item.id, { sac_code: e.target.value })}
                    />
                    <div style={{ position: "relative" }}>
                      <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "var(--text-muted)" }}>₹</span>
                      <input
                        className="input input-sm"
                        type="number"
                        min="0"
                        placeholder="0"
                        value={item.amount}
                        disabled={!can("editor")}
                        style={{ paddingLeft: 22 }}
                        onChange={(e) => updateItem(item.id, { amount: Number(e.target.value) })}
                      />
                    </div>
                    {!isB ? (
                      <label title="Show in red" style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: item.is_red ? "#C00000" : "var(--text-muted)", cursor: "pointer", whiteSpace: "nowrap" }}>
                        <input type="checkbox" checked={item.is_red} disabled={!can("editor")} onChange={(e) => updateItem(item.id, { is_red: e.target.checked })} style={{ accentColor: "#C00000" }} />
                        Red
                      </label>
                    ) : <span />}
                    <label title="Include in invoice" style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: item.enabled ? "var(--accent)" : "var(--text-muted)", cursor: "pointer" }}>
                      <input type="checkbox" checked={item.enabled} disabled={!can("editor")} onChange={(e) => updateItem(item.id, { enabled: e.target.checked })} style={{ accentColor: "var(--accent)" }} />
                      {item.enabled ? "On" : "Off"}
                    </label>
                    {can("editor") && (
                      <button className="btn btn-ghost btn-sm btn-icon" onClick={() => removeItem(item.id)} style={{ color: "var(--danger)" }}>
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                ))}
                {can("editor") && (
                  <button className="btn btn-ghost btn-sm" style={{ marginTop: 6 }} onClick={() => addItem(isB)}>
                    <Plus size={13} /> Add {isB ? "non-taxable" : "taxable"} particular
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", fontWeight: 600, fontSize: 13 }}>
          Default GST
        </div>
        <div style={{ padding: "16px 18px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16 }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Default Invoice Date</label>
            <input
              className="input input-sm"
              type="date"
              value={config.invoice_date ?? ""}
              disabled={!can("editor")}
              onChange={(e) => setField("invoice_date", e.target.value || null)}
            />
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>
              Suggested date when opening generate-invoice. Blank = today.
            </div>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">GST Type</label>
            <select
              className="input input-sm"
              value={config.gst_type}
              disabled={!can("editor")}
              onChange={(e) => setField("gst_type", e.target.value as "IGST" | "CGST_SGST")}
            >
              <option value="IGST">IGST (Inter-state)</option>
              <option value="CGST_SGST">CGST + SGST (Intra-state)</option>
            </select>
          </div>
          {config.gst_type === "IGST" ? (
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">IGST Rate (%)</label>
              <input className="input input-sm" type="number" min="0" max="100" step="0.5"
                value={config.igst_rate} disabled={!can("editor")}
                onChange={(e) => setField("igst_rate", Number(e.target.value))} />
            </div>
          ) : (
            <>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">CGST Rate (%)</label>
                <input className="input input-sm" type="number" min="0" max="50" step="0.5"
                  value={config.cgst_rate} disabled={!can("editor")}
                  onChange={(e) => setField("cgst_rate", Number(e.target.value))} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">SGST Rate (%)</label>
                <input className="input input-sm" type="number" min="0" max="50" step="0.5"
                  value={config.sgst_rate} disabled={!can("editor")}
                  onChange={(e) => setField("sgst_rate", Number(e.target.value))} />
              </div>
            </>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", fontWeight: 600, fontSize: 13, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Bank Account Details</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>Shown on invoices (max 2)</span>
        </div>
        <div style={{ padding: "12px 18px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {(config.bank_accounts ?? []).map((bank, bi) => (
            <div key={bi} style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 12 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                <input
                  className="input input-sm"
                  placeholder="Bank title"
                  value={bank.title}
                  disabled={!can("editor")}
                  style={{ fontWeight: 600 }}
                  onChange={(e) => setBankTitle(bi, e.target.value)}
                />
                {can("editor") && (
                  <button className="btn btn-ghost btn-sm btn-icon" title="Remove bank" onClick={() => removeBank(bi)} style={{ color: "var(--danger)" }}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              {bank.details.map((d, di) => (
                <div key={di} style={{ display: "grid", gridTemplateColumns: "130px 1fr auto", gap: 6, marginBottom: 6 }}>
                  <input className="input input-sm" placeholder="Field" value={d.label} disabled={!can("editor")}
                    onChange={(e) => setBankDetail(bi, di, { label: e.target.value })} />
                  <input className="input input-sm" placeholder="Value" value={d.value} disabled={!can("editor")}
                    onChange={(e) => setBankDetail(bi, di, { value: e.target.value })} />
                  {can("editor") && (
                    <button className="btn btn-ghost btn-sm btn-icon" onClick={() => removeBankDetail(bi, di)} style={{ color: "var(--text-muted)" }}>
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
              {can("editor") && (
                <button className="btn btn-ghost btn-sm" onClick={() => addBankDetail(bi)}><Plus size={12} /> Add field</button>
              )}
            </div>
          ))}
        </div>
        {can("editor") && (config.bank_accounts ?? []).length < 2 && (
          <div style={{ padding: "0 18px 14px" }}>
            <button className="btn btn-ghost btn-sm" onClick={addBank}><Plus size={13} /> Add bank account</button>
          </div>
        )}
      </div>

      <div className="card">
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", fontWeight: 600, fontSize: 13 }}>Preview Totals (enabled items, per ISIN)</div>
        <div style={{ padding: "14px 18px", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          {[
            { label: "Taxable Value", value: taxable },
            { label: "Non-Taxable", value: nonTaxable },
            { label: `GST (${config.gst_type === "IGST" ? `IGST ${config.igst_rate}%` : `CGST+SGST ${config.cgst_rate + config.sgst_rate}%`})`, value: gstAmt },
            { label: "Grand Total", value: grand },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: "var(--bg)", borderRadius: "var(--radius)", padding: "12px 14px" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                ₹{value.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
