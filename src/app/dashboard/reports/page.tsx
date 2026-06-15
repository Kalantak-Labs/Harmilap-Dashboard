"use client";

import { useEffect, useState } from "react";
import { Download, FileText, Search, X, RefreshCw, Calendar } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import type { CompanyListItem } from "@/lib/types";

type ReportType = "benpos" | "reconciliation";

const REPORT_META: Record<ReportType, { label: string; desc: string; color: string; filename: (isin: string) => string }> = {
  benpos: {
    label: "Beneficiary Position",
    desc: "BENPOS report with DP/Client IDs, shareholder names, and position data.",
    color: "var(--accent)",
    filename: (isin) => `BENPOS_${isin}.pdf`,
  },
  reconciliation: {
    label: "Reconciliation Report",
    desc: "Share capital reconciliation: NSDL / CDSL / Physical breakdown with percentages.",
    color: "#16a34a",
    filename: (isin) => `Reconciliation_${isin}.pdf`,
  },
};

interface ReconParams {
  report_date: string;
  ref_prefix: string;
}

function defaultReconParams(): ReconParams {
  const today = new Date();
  const fy = today.getMonth() >= 3
    ? `${today.getFullYear()}-${String(today.getFullYear() + 1).slice(2)}`
    : `${today.getFullYear() - 1}-${String(today.getFullYear()).slice(2)}`;
  const mon = today.toLocaleString("en-US", { month: "short" }).toUpperCase();
  const yr  = String(today.getFullYear()).slice(2);
  return {
    report_date: today.toISOString().slice(0, 10),
    ref_prefix:  `${fy}/NSDL/${mon}${yr}`,
  };
}

export default function ReportsPage() {
  const { push } = useToast();

  const [companies, setCompanies] = useState<CompanyListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [skip, setSkip] = useState(0);
  const limit = 50;
  const [generating, setGenerating] = useState<string | null>(null);

  // Reconciliation modal state
  const [reconModal, setReconModal] = useState<{
    mode: "single" | "bulk";
    companyId?: string;
    isin?: string;
    params: ReconParams;
  } | null>(null);

  // Depository picker modal state
  const [benposModal, setBenposModal] = useState<{
    companyId: string;
    isin: string;
  } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const p: Record<string, string | number> = { skip, limit };
      if (search) p.search = search;
      const [list, cnt] = await Promise.all([
        api.companies.list(p),
        api.companies.count(p),
      ]);
      setCompanies(list);
      setTotal(cnt.count);
    } catch (e: unknown) {
      push("error", e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [search, skip]);

  const generate = async (type: ReportType, companyId: string, isin: string, company?: CompanyListItem) => {
    if (type === "reconciliation") {
      setReconModal({ mode: "single", companyId, isin, params: defaultReconParams() });
      return;
    }
    if (type === "benpos" && company?.has_nsdl_shares && company?.has_cdsl_shares) {
      setBenposModal({ companyId, isin });
      return;
    }
    const depository = company?.has_cdsl_shares ? "CDSL" : company?.has_nsdl_shares ? "NSDL" : undefined;
    const key = `${type}:${companyId}`;
    setGenerating(key);
    try {
      const url = api.reports.downloadBenpos(companyId, depository);
      const filename = depository
        ? `BENPOS_${isin}_${depository}.pdf`
        : REPORT_META[type].filename(isin);
      await api.reports.generate(url, filename);
    } catch (e: unknown) {
      push("error", e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(null);
    }
  };

  const downloadBenposWithDepository = async (depository: string) => {
    if (!benposModal) return;
    const { companyId, isin } = benposModal;
    setBenposModal(null);
    const key = `benpos:${companyId}`;
    setGenerating(key);
    try {
      const url = api.reports.downloadBenpos(companyId, depository);
      await api.reports.generate(url, `BENPOS_${isin}_${depository}.pdf`);
    } catch (e: unknown) {
      push("error", e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(null);
    }
  };

  const generateBulk = async (type: ReportType) => {
    if (type === "reconciliation") {
      setReconModal({ mode: "bulk", params: defaultReconParams() });
      return;
    }
    const key = `${type}:bulk`;
    setGenerating(key);
    try {
      const url = api.reports.downloadBenposBulk();
      const filenames: Record<ReportType, string> = {
        benpos: "BENPOS_Bulk.zip",
        reconciliation: "Reconciliation_Bulk.zip",
      };
      await api.reports.generate(url, filenames[type]);
    } catch (e: unknown) {
      push("error", e instanceof Error ? e.message : "Bulk generation failed");
    } finally {
      setGenerating(null);
    }
  };

  const confirmRecon = async () => {
    if (!reconModal) return;
    const { mode, companyId, isin, params } = reconModal;
    const reconParams = {
      report_date: params.report_date || undefined,
      ref_prefix: params.ref_prefix || undefined,
    };
    if (mode === "single" && companyId && isin) {
      const key = `reconciliation:${companyId}`;
      setGenerating(key);
      setReconModal(null);
      try {
        const url = api.reports.downloadReconciliation(companyId, reconParams);
        await api.reports.generate(url, REPORT_META.reconciliation.filename(isin));
      } catch (e: unknown) {
        push("error", e instanceof Error ? e.message : "Generation failed");
      } finally {
        setGenerating(null);
      }
    } else {
      setGenerating("reconciliation:bulk");
      setReconModal(null);
      try {
        const url = api.reports.downloadReconciliationBulk(reconParams);
        await api.reports.generate(url, "Reconciliation_Bulk.zip");
      } catch (e: unknown) {
        push("error", e instanceof Error ? e.message : "Bulk generation failed");
      } finally {
        setGenerating(null);
      }
    }
  };

  const totalPages = Math.ceil(total / limit);
  const page = Math.floor(skip / limit);

  return (
    <div>
      {/* Reconciliation params modal */}
      {reconModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)" }} onClick={() => setReconModal(null)} />
          <div className="card" style={{ position: "relative", zIndex: 1, width: 420, padding: "24px 24px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Reconciliation Report</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                  {reconModal.mode === "bulk" ? "Bulk generation — set parameters" : `For ${reconModal.isin}`}
                </div>
              </div>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setReconModal(null)}><X size={15} /></button>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Calendar size={13} /> Report Date (as on)
              </label>
              <input
                className="input input-sm"
                type="date"
                value={reconModal.params.report_date}
                onChange={(e) => setReconModal((m) => m ? { ...m, params: { ...m.params, report_date: e.target.value } } : m)}
              />
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>
                Appears in title: &quot;Report on Share Capital Reconciliation Report as on…&quot;
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Reference Number Prefix</label>
              <input
                className="input input-sm"
                placeholder="e.g. 2026-27/NSDL/MAR26"
                value={reconModal.params.ref_prefix}
                onChange={(e) => setReconModal((m) => m ? { ...m, params: { ...m.params, ref_prefix: e.target.value } } : m)}
              />
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>
                Full ref: <code>{reconModal.params.ref_prefix}/RTAN&lt;rta_code&gt;</code>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setReconModal(null)}>Cancel</button>
              <button className="btn btn-primary btn-sm" style={{ background: "#16a34a", borderColor: "#16a34a" }} onClick={confirmRecon}>
                Generate PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Depository picker modal */}
      {benposModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)" }} onClick={() => setBenposModal(null)} />
          <div className="card" style={{ position: "relative", zIndex: 1, width: 360, padding: "24px 24px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Download BENPOS Report</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                  {benposModal.isin} — both NSDL &amp; CDSL data available
                </div>
              </div>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setBenposModal(null)}><X size={15} /></button>
            </div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
              Choose which depository report to download:
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                className="btn btn-primary btn-sm"
                style={{ flex: 1 }}
                onClick={() => downloadBenposWithDepository("NSDL")}
              >
                <Download size={14} /> NSDL
              </button>
              <button
                className="btn btn-primary btn-sm"
                style={{ flex: 1, background: "#2563eb", borderColor: "#2563eb" }}
                onClick={() => downloadBenposWithDepository("CDSL")}
              >
                <Download size={14} /> CDSL
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="page-header">
        <div>
          <h2>Reports</h2>
          <div style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 2 }}>
            Generate PDFs per company or in bulk
          </div>
        </div>
      </div>

      {/* Bulk generation cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 20 }}>
        {(Object.keys(REPORT_META) as ReportType[]).map((type) => {
          const meta = REPORT_META[type];
          const key = `${type}:bulk`;
          const busy = generating === key;
          return (
            <div key={type} className="card" style={{ padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: meta.color }}>{meta.label}</div>
                <FileText size={16} style={{ color: meta.color, flexShrink: 0 }} />
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 14, lineHeight: 1.5 }}>{meta.desc}</div>
              <button
                className="btn btn-secondary btn-sm"
                style={{ width: "100%" }}
                onClick={() => generateBulk(type)}
                disabled={!!generating}
              >
                {busy ? <span className="spinner" /> : <Download size={14} />}
                {busy ? "Generating…" : `Generate All (ZIP)`}
              </button>
            </div>
          );
        })}
      </div>

      {/* Search */}
      <div className="filter-bar">
        <div style={{ position: "relative", flex: 1, minWidth: 200, maxWidth: 360 }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input
            className="input input-sm"
            style={{ paddingLeft: 32 }}
            placeholder="Search company name, ISIN…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setSkip(0); }}
          />
        </div>
        {search && (
          <button className="btn btn-ghost btn-sm" onClick={() => setSearch("")}><X size={13} /> Clear</button>
        )}
        <button className="btn btn-ghost btn-sm btn-icon" onClick={load}><RefreshCw size={14} /></button>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-muted)" }}>{total} companies</span>
      </div>

      {/* Per-company table */}
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Company</th>
                <th>ISIN</th>
                <th>Security Type</th>
                <th style={{ textAlign: "center" }}>BENPOS</th>
                <th style={{ textAlign: "center" }}>Reconciliation</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5}><div className="spinner-center"><span className="spinner" /></div></td></tr>
              ) : companies.length === 0 ? (
                <tr><td colSpan={5}>
                  <div className="empty-state"><FileText size={28} /><div>No companies found</div></div>
                </td></tr>
              ) : companies.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 500 }}>{c.company_name ?? <span style={{ color: "var(--text-muted)" }}>—</span>}</td>
                  <td><code style={{ fontSize: 11, background: "var(--bg)", padding: "1px 5px", borderRadius: 3 }}>{c.isin_code ?? c.arn_number}</code></td>
                  <td>{c.security_type ? <span className="badge badge-gray">{c.security_type}</span> : "—"}</td>
                  {(["benpos", "reconciliation"] as ReportType[]).map((type) => {
                    const key = `${type}:${c.id}`;
                    const busy = generating === key;
                    return (
                      <td key={type} style={{ textAlign: "center" }}>
                        <button
                          className="btn btn-ghost btn-sm btn-icon"
                          title={`Download ${REPORT_META[type].label}`}
                          onClick={() => generate(type, c.id, c.isin_code ?? c.arn_number ?? "", c)}
                          disabled={!!generating}
                          style={{ color: busy ? "var(--text-muted)" : REPORT_META[type].color }}
                        >
                          {busy ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <Download size={14} />}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderTop: "1px solid var(--border)", fontSize: 13, color: "var(--text-secondary)" }}>
            <span>Page {page + 1} of {totalPages}</span>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setSkip(Math.max(0, skip - limit))} disabled={skip === 0}>Previous</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setSkip(skip + limit)} disabled={page >= totalPages - 1}>Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
