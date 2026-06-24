"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Upload, Download, Search, X, RefreshCw, Users } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/Toast";
import type { BeneficiaryListItem, ZipIngestResult } from "@/lib/types";
import { ColumnFilter } from "@/components/ui/ColumnFilter";
import { filtersToParam, activeFilterCount, type ColFilters } from "@/lib/filters";

const BENEF_TYPE: Record<number, string> = {
  1: "Resident", 2: "FI", 3: "FII", 4: "NRI", 5: "Body Corporate",
  6: "CM", 7: "Foreign National", 8: "Mutual Fund", 9: "Trust", 10: "Bank", 11: "QFI",
};
const ACCT_CAT: Record<number, string> = { 1: "House", 2: "Non House", 3: "CM", 4: "CC" };

export default function BeneficiariesPage() {
  const { can } = useAuth();
  const { push } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [rows, setRows] = useState<BeneficiaryListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isin, setIsin] = useState(searchParams.get("isin") ?? "");
  const [search, setSearch] = useState("");
  const [colFilters, setColFilters] = useState<ColFilters>({});
  const [skip, setSkip] = useState(0);
  const limit = 50;

  const setCol = (key: string, val: string) => { setColFilters((p) => ({ ...p, [key]: val })); setSkip(0); };
  const colF = (key: string, label: string, kind: "text" | "bool" = "text") => (
    <ColumnFilter label={label} value={colFilters[key] ?? ""} onChange={(v) => setCol(key, v)} kind={kind} />
  );

  const [ingesting, setIngesting] = useState(false);
  const [ingestResult, setIngestResult] = useState<ZipIngestResult | null>(null);
  const [cdslIngesting, setCdslIngesting] = useState(false);
  const [cdslIngestResult, setCdslIngestResult] = useState<ZipIngestResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cdslFileRef = useRef<HTMLInputElement>(null);

  const params = () => ({
    ...(isin ? { isin_code: isin } : {}),
    ...(search ? { search } : {}),
    ...(filtersToParam(colFilters) ? { filters: filtersToParam(colFilters) } : {}),
    skip,
    limit,
  });

  const load = async () => {
    setLoading(true);
    try {
      const p = params() as Record<string, string | number | boolean | undefined>;
      const [list, cnt] = await Promise.all([
        api.beneficiaries.list(p),
        api.beneficiaries.count(p),
      ]);
      setRows(list);
      setTotal(cnt.count);
    } catch (e: unknown) {
      push("error", e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [isin, search, JSON.stringify(colFilters), skip]);

  const handleIngest = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    e.target.value = "";
    setIngesting(true);
    try {
      const result = await api.beneficiaries.ingestZip(f);
      setIngestResult(result);
      push("success", `ZIP processed: ${result.files_processed} files, ${result.total_created} created, ${result.total_updated} updated`);
      load();
    } catch (err: unknown) {
      push("error", err instanceof Error ? err.message : "Ingest failed");
    } finally {
      setIngesting(false);
    }
  };

  const handleCdslIngest = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    e.target.value = "";
    setCdslIngesting(true);
    try {
      const result = await api.beneficiaries.ingestCdslZip(f);
      setCdslIngestResult(result);
      push("success", `CDSL ZIP processed: ${result.total_created} created, ${result.total_updated} updated, ${result.cdsl_updated} companies updated`);
      load();
    } catch (err: unknown) {
      push("error", err instanceof Error ? err.message : "CDSL ingest failed");
    } finally {
      setCdslIngesting(false);
    }
  };

  const handleExport = () => {
    const p: Record<string, string> = {};
    if (isin) p.isin_code = isin;
    if (search) p.search = search;
    const fp = filtersToParam(colFilters);
    if (fp) p.filters = fp;
    const url = api.beneficiaries.exportUrl(p);
    fetch(url, { headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `beneficiaries${isin ? "_" + isin : ""}.xlsx`;
        a.click();
      })
      .catch(() => push("error", "Export failed"));
  };

  const totalPages = Math.ceil(total / limit);
  const page = Math.floor(skip / limit);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Beneficiaries</h2>
          <div style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 2 }}>{total} records{isin ? ` · ISIN: ${isin}` : ""}</div>
        </div>
        <div className="page-header-actions">
          {can("can_ingest") && (
            <>
              <input ref={fileRef} type="file" accept=".zip" style={{ display: "none" }} onChange={handleIngest} />
              <button className="btn btn-secondary" onClick={() => fileRef.current?.click()} disabled={ingesting}>
                {ingesting ? <span className="spinner" /> : <Upload size={15} />}
                {ingesting ? "Processing…" : "Upload NSDL ZIP"}
              </button>
              <input ref={cdslFileRef} type="file" accept=".zip" style={{ display: "none" }} onChange={handleCdslIngest} />
              <button className="btn btn-secondary" onClick={() => cdslFileRef.current?.click()} disabled={cdslIngesting}>
                {cdslIngesting ? <span className="spinner" /> : <Upload size={15} />}
                {cdslIngesting ? "Processing…" : "Upload CDSL ZIP"}
              </button>
            </>
          )}
          {can("can_download") && (
            <button className="btn btn-secondary" onClick={handleExport}>
              <Download size={15} /> Export
            </button>
          )}
        </div>
      </div>

      {/* NSDL Ingest result */}
      {ingestResult && (
        <div style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          {ingestResult.unknown_isins.length > 0 && (
            <div style={{ padding: "12px 16px", background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: "var(--radius)", fontSize: 13 }}>
              <div style={{ fontWeight: 600, color: "#92400e", marginBottom: 6 }}>
                ⚠ {ingestResult.unknown_isins.length} ISIN{ingestResult.unknown_isins.length > 1 ? "s" : ""} not found in Companies — files skipped
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {ingestResult.unknown_isins.map((isin) => (
                  <code key={isin} style={{ fontSize: 12, background: "#fef3c7", padding: "2px 8px", borderRadius: 4, border: "1px solid #fcd34d", color: "#78350f" }}>{isin}</code>
                ))}
              </div>
              <div style={{ fontSize: 12, color: "#92400e", marginTop: 6 }}>Add these companies first, then re-upload the ZIP.</div>
            </div>
          )}
          <div style={{ padding: "12px 16px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "var(--radius)", fontSize: 13 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <strong>NSDL ingest:</strong> {ingestResult.files_processed} files · {ingestResult.total_created} created · {ingestResult.total_updated} updated · {ingestResult.total_skipped} skipped
                {ingestResult.files_skipped > 0 && <span style={{ color: "var(--warning)", marginLeft: 8 }}>{ingestResult.files_skipped} files skipped</span>}
                {ingestResult.nsdl_updated > 0 && (
                  <span style={{ color: "var(--text-secondary)", marginLeft: 8 }}>· NSDL shares updated for {ingestResult.nsdl_updated} compan{ingestResult.nsdl_updated === 1 ? "y" : "ies"}</span>
                )}
                {ingestResult.errors.length > 0 && (
                  <div style={{ color: "var(--danger)", marginTop: 4, fontSize: 12 }}>
                    {ingestResult.errors.slice(0, 3).join(" | ")}{ingestResult.errors.length > 3 ? ` +${ingestResult.errors.length - 3} more` : ""}
                  </div>
                )}
              </div>
              <button onClick={() => setIngestResult(null)} style={{ color: "var(--text-muted)", display: "flex" }}><X size={14} /></button>
            </div>
          </div>
        </div>
      )}

      {/* CDSL Ingest result */}
      {cdslIngestResult && (
        <div style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          {cdslIngestResult.unknown_isins.length > 0 && (
            <div style={{ padding: "12px 16px", background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: "var(--radius)", fontSize: 13 }}>
              <div style={{ fontWeight: 600, color: "#92400e", marginBottom: 6 }}>
                ⚠ {cdslIngestResult.unknown_isins.length} ISIN{cdslIngestResult.unknown_isins.length > 1 ? "s" : ""} not found in Companies (CDSL)
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {cdslIngestResult.unknown_isins.map((isin) => (
                  <code key={isin} style={{ fontSize: 12, background: "#fef3c7", padding: "2px 8px", borderRadius: 4, border: "1px solid #fcd34d", color: "#78350f" }}>{isin}</code>
                ))}
              </div>
            </div>
          )}
          <div style={{ padding: "12px 16px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "var(--radius)", fontSize: 13 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <strong>CDSL ingest:</strong> {cdslIngestResult.total_created} created · {cdslIngestResult.total_updated} updated · {cdslIngestResult.total_skipped} skipped
                {cdslIngestResult.cdsl_updated > 0 && (
                  <span style={{ color: "var(--text-secondary)", marginLeft: 8 }}>· CDSL shares updated for {cdslIngestResult.cdsl_updated} compan{cdslIngestResult.cdsl_updated === 1 ? "y" : "ies"}</span>
                )}
                {cdslIngestResult.errors.length > 0 && (
                  <div style={{ color: "var(--danger)", marginTop: 4, fontSize: 12 }}>
                    {cdslIngestResult.errors.slice(0, 3).join(" | ")}{cdslIngestResult.errors.length > 3 ? ` +${cdslIngestResult.errors.length - 3} more` : ""}
                  </div>
                )}
              </div>
              <button onClick={() => setCdslIngestResult(null)} style={{ color: "var(--text-muted)", display: "flex" }}><X size={14} /></button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="filter-bar">
        <div style={{ position: "relative", minWidth: 200, maxWidth: 280 }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input
            className="input input-sm"
            style={{ paddingLeft: 32 }}
            placeholder="Name, PAN, DP ID, client ID…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setSkip(0); }}
          />
        </div>
        <input
          className="input input-sm"
          style={{ width: 180 }}
          placeholder="Filter by ISIN…"
          value={isin}
          onChange={(e) => { setIsin(e.target.value.toUpperCase()); setSkip(0); }}
        />
        {(search || isin || activeFilterCount(colFilters) > 0) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(""); setIsin(""); setColFilters({}); setSkip(0); }}><X size={13} /> Clear</button>
        )}
        <button className="btn btn-ghost btn-sm btn-icon" onClick={load}><RefreshCw size={14} /></button>
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Holder Name{colF("first_holder_name", "Holder Name")}</th>
                <th>ISIN{colF("isin_code", "ISIN")}</th>
                <th>Depository{colF("depository", "Depository")}</th>
                <th>DP ID{colF("dp_id", "DP ID")}</th>
                <th>Client ID{colF("client_id", "Client ID")}</th>
                <th>PAN{colF("first_holder_pan", "PAN")}</th>
                <th>Type{colF("beneficiary_type", "Type")}</th>
                <th style={{ textAlign: "right" }}>Free{colF("free_positions", "Free")}</th>
                <th style={{ textAlign: "right" }}>Lock-in{colF("lockin_positions", "Lock-in")}</th>
                <th style={{ textAlign: "right" }}>Pledged{colF("pledged_positions", "Pledged")}</th>
                <th>Record Date{colF("record_date", "Record Date")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={12}><div className="spinner-center"><span className="spinner" /></div></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={12}>
                  <div className="empty-state">
                    <Users size={32} />
                    <div>No beneficiaries found</div>
                    {!isin && <div style={{ fontSize: 12 }}>Filter by ISIN or upload a ZIP to get started</div>}
                  </div>
                </td></tr>
              ) : rows.map((b) => (
                <tr key={b.id} style={{ cursor: "pointer" }} onClick={() => router.push(`/dashboard/beneficiaries/${b.id}`)}>
                  <td style={{ fontWeight: 500 }}>{b.first_holder_name ?? <span style={{ color: "var(--text-muted)" }}>—</span>}</td>
                  <td><code style={{ fontSize: 11, background: "var(--bg)", padding: "1px 5px", borderRadius: 3 }}>{b.isin_code}</code></td>
                  <td><span className={`badge ${b.depository === "CDSL" ? "badge-blue" : "badge-gray"}`} style={{ fontSize: 11 }}>{b.depository}</span></td>
                  <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{b.dp_id}</td>
                  <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{b.client_id}</td>
                  <td style={{ fontFamily: "monospace", fontSize: 12 }}>{b.first_holder_pan ?? "—"}</td>
                  <td>{b.beneficiary_type ? <span className="badge badge-gray" style={{ fontSize: 11 }}>{BENEF_TYPE[b.beneficiary_type] ?? b.beneficiary_type}</span> : "—"}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{b.free_positions?.toLocaleString() ?? "—"}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{b.lockin_positions ? <span style={{ color: "var(--warning)" }}>{b.lockin_positions.toLocaleString()}</span> : "—"}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{b.pledged_positions ? <span style={{ color: "var(--danger)" }}>{b.pledged_positions.toLocaleString()}</span> : "—"}</td>
                  <td style={{ color: "var(--text-muted)", fontSize: 12 }}>{b.record_date ? new Date(b.record_date).toLocaleDateString("en-IN") : "—"}</td>
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
