"use client";

import { useEffect, useState, useRef } from "react";
import { Plus, Upload, Download, Search, X, RefreshCw, Building2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/Toast";
import type { CompanyListItem, IngestResult } from "@/lib/types";
import CompanyCreateModal from "@/components/companies/CompanyCreateModal";

export default function CompaniesPage() {
  const { can } = useAuth();
  const { push } = useToast();

  const [companies, setCompanies] = useState<CompanyListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [secType, setSecType] = useState("");
  const [hasNsdl, setHasNsdl] = useState<string>("");
  const [hasCdsl, setHasCdsl] = useState<string>("");
  const [skip, setSkip] = useState(0);
  const limit = 50;

  const [showCreate, setShowCreate] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [ingestResult, setIngestResult] = useState<IngestResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const params = () => ({
    ...(search ? { search } : {}),
    ...(secType ? { security_type: secType } : {}),
    ...(hasNsdl !== "" ? { has_nsdl: hasNsdl === "true" } : {}),
    ...(hasCdsl !== "" ? { has_cdsl: hasCdsl === "true" } : {}),
    skip,
    limit,
  });

  const load = async () => {
    setLoading(true);
    try {
      const [list, cnt] = await Promise.all([
        api.companies.list(params() as Record<string, string | number | boolean | undefined>),
        api.companies.count(params() as Record<string, string | number | boolean | undefined>),
      ]);
      setCompanies(list);
      setTotal(cnt.count);
    } catch (e: unknown) {
      push("error", e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [search, secType, hasNsdl, hasCdsl, skip]);

  const handleIngest = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setIngesting(true);
    try {
      const result = await api.companies.ingest(file);
      setIngestResult(result);
      push("success", `Ingest complete: ${result.created} created, ${result.updated} updated`);
      load();
    } catch (err: unknown) {
      push("error", err instanceof Error ? err.message : "Ingest failed");
    } finally {
      setIngesting(false);
    }
  };

  const handleExport = () => {
    const p: Record<string, string> = {};
    if (search) p.search = search;
    if (secType) p.security_type = secType;
    if (hasNsdl !== "") p.has_nsdl = hasNsdl;
    if (hasCdsl !== "") p.has_cdsl = hasCdsl;
    const url = api.companies.exportUrl(p);
    const a = document.createElement("a");
    a.href = `${url}&_token=${localStorage.getItem("access_token")}`;
    // Use fetch for auth-required download
    fetch(url, { headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "companies.xlsx";
        link.click();
      })
      .catch(() => push("error", "Export failed"));
  };

  const clearFilters = () => { setSearch(""); setSecType(""); setHasNsdl(""); setHasCdsl(""); setSkip(0); };
  const hasFilters = search || secType || hasNsdl !== "" || hasCdsl !== "";

  const totalPages = Math.ceil(total / limit);
  const page = Math.floor(skip / limit);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Companies</h2>
          <div style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 2 }}>{total} records</div>
        </div>
        <div className="page-header-actions">
          {can("can_ingest") && (
            <>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={handleIngest} />
              <button className="btn btn-secondary" onClick={() => fileRef.current?.click()} disabled={ingesting}>
                {ingesting ? <span className="spinner" /> : <Upload size={15} />}
                {ingesting ? "Ingesting…" : "Import Excel"}
              </button>
            </>
          )}
          {can("can_download") && (
            <button className="btn btn-secondary" onClick={handleExport}>
              <Download size={15} /> Export
            </button>
          )}
          {can("editor") && (
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              <Plus size={15} /> Add Company
            </button>
          )}
        </div>
      </div>

      {/* Ingest result banner */}
      {ingestResult && (
        <div style={{ marginBottom: 16, padding: "12px 16px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "var(--radius)", fontSize: 13 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <strong>Last ingest:</strong> {ingestResult.created} created · {ingestResult.updated} updated · {ingestResult.skipped} skipped
              {ingestResult.errors.length > 0 && (
                <div style={{ color: "var(--danger)", marginTop: 4 }}>{ingestResult.errors.slice(0, 3).join(" | ")}{ingestResult.errors.length > 3 ? ` + ${ingestResult.errors.length - 3} more` : ""}</div>
              )}
            </div>
            <button onClick={() => setIngestResult(null)} style={{ color: "var(--text-muted)", display: "flex" }}><X size={14} /></button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="filter-bar">
        <div style={{ position: "relative", flex: 1, minWidth: 200, maxWidth: 320 }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input
            className="input input-sm"
            style={{ paddingLeft: 32 }}
            placeholder="Search name, ISIN, ARN, RTA code, PAN…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setSkip(0); }}
          />
        </div>

        <input
          className="input input-sm"
          style={{ width: 160 }}
          placeholder="Security type…"
          value={secType}
          onChange={(e) => { setSecType(e.target.value); setSkip(0); }}
        />

        <select className="input input-sm" style={{ width: 130 }} value={hasNsdl} onChange={(e) => { setHasNsdl(e.target.value); setSkip(0); }}>
          <option value="">NSDL: All</option>
          <option value="true">Has NSDL</option>
          <option value="false">No NSDL</option>
        </select>

        <select className="input input-sm" style={{ width: 130 }} value={hasCdsl} onChange={(e) => { setHasCdsl(e.target.value); setSkip(0); }}>
          <option value="">CDSL: All</option>
          <option value="true">Has CDSL</option>
          <option value="false">No CDSL</option>
        </select>

        {hasFilters && (
          <button className="btn btn-ghost btn-sm" onClick={clearFilters}><X size={13} /> Clear</button>
        )}

        <button className="btn btn-ghost btn-sm btn-icon" onClick={load} title="Refresh">
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Company Name</th>
                <th>ISIN / ARN</th>
                <th>NSDL RTA</th>
                <th>CDSL RTA</th>
                <th>Security Type</th>
                <th style={{ textAlign: "right" }}>Total Shares</th>
                <th>NSDL</th>
                <th>CDSL</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9}><div className="spinner-center"><span className="spinner" /></div></td></tr>
              ) : companies.length === 0 ? (
                <tr><td colSpan={9}>
                  <div className="empty-state">
                    <Building2 size={32} />
                    <div>No companies found</div>
                    {hasFilters && <div style={{ fontSize: 12 }}>Try clearing your filters</div>}
                  </div>
                </td></tr>
              ) : companies.map((c) => (
                <tr key={c.id} style={{ cursor: "pointer" }} onClick={() => window.location.href = `/dashboard/companies/${c.id}`}>
                  <td style={{ fontWeight: 500 }}>{c.company_name ?? <span style={{ color: "var(--text-muted)" }}>—</span>}</td>
                  <td>
                    {c.isin_code ? (
                      <code style={{ fontSize: 12, background: "var(--bg)", padding: "2px 6px", borderRadius: "var(--radius-sm)" }}>{c.isin_code}</code>
                    ) : c.arn_number ? (
                      <code style={{ fontSize: 12, background: "var(--bg)", padding: "2px 6px", borderRadius: "var(--radius-sm)" }}>{c.arn_number}<span style={{ color: "var(--text-muted)", marginLeft: 4 }}>ARN</span></code>
                    ) : (
                      <span style={{ color: "var(--text-muted)" }}>—</span>
                    )}
                  </td>
                  <td style={{ fontSize: 12 }}>{c.nsdl_rta_code ?? <span style={{ color: "var(--text-muted)" }}>—</span>}</td>
                  <td style={{ fontSize: 12 }}>{c.cdsl_rta_code ?? <span style={{ color: "var(--text-muted)" }}>—</span>}</td>
                  <td>{c.security_type ? <span className="badge badge-gray">{c.security_type}</span> : <span style={{ color: "var(--text-muted)" }}>—</span>}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{c.total_shares?.toLocaleString() ?? "—"}</td>
                  <td>{c.has_nsdl_shares ? <span className="badge badge-green">Yes</span> : <span className="badge badge-gray">No</span>}</td>
                  <td>{c.has_cdsl_shares ? <span className="badge badge-blue">Yes</span> : <span className="badge badge-gray">No</span>}</td>
                  <td style={{ color: "var(--text-muted)", fontSize: 12 }}>{new Date(c.updated_at).toLocaleDateString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
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

      {showCreate && (
        <CompanyCreateModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(); }}
        />
      )}
    </div>
  );
}
