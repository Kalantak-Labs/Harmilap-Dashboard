"use client";

import { useCallback, useEffect, useState, Fragment } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import type { ActionLog } from "@/lib/types";

const PAGE_SIZE = 50;

function actionLabel(action: string, resourceType: string): string {
  const map: Record<string, string> = {
    login: "Login",
    logout: "Logout",
    password_change: "Password changed",
    create: "Created",
    update: "Updated",
    delete: "Deleted",
    export: "Exported",
    ingest: "Uploaded / ingested",
    import: "Imported",
    generate: "Generated",
    download: "Downloaded",
    send: "Sent",
    test: "Tested",
  };
  const verb = map[action] || action;
  const resource = resourceType.replace(/_/g, " ");
  return `${verb} ${resource}`;
}

function formatDetails(details: Record<string, unknown> | null): string {
  if (!details) return "—";
  return JSON.stringify(details, null, 2);
}

function ChangesBlock({ details }: { details: Record<string, unknown> | null }) {
  const changes = details?.changes as Record<string, { from: unknown; to: unknown }> | undefined;
  if (!changes || Object.keys(changes).length === 0) {
    return (
      <pre style={{ margin: 0, fontSize: 12, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
        {formatDetails(details)}
      </pre>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 600 }}>Field changes</div>
      <div style={{ display: "grid", gap: 6 }}>
        {Object.entries(changes).map(([field, change]) => (
          <div key={field} style={{ fontSize: 12, background: "var(--bg)", borderRadius: 6, padding: "8px 10px" }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{field.replace(/_/g, " ")}</div>
            <div style={{ color: "var(--text-muted)" }}>From: {JSON.stringify(change.from)}</div>
            <div>To: {JSON.stringify(change.to)}</div>
          </div>
        ))}
      </div>
      {Object.keys(details || {}).length > 1 && (
        <details>
          <summary style={{ fontSize: 12, cursor: "pointer", color: "var(--text-secondary)" }}>Full details</summary>
          <pre style={{ marginTop: 8, fontSize: 11, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {formatDetails(details)}
          </pre>
        </details>
      )}
    </div>
  );
}

export default function ActionLogsPage() {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const [items, setItems] = useState<ActionLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [resourceType, setResourceType] = useState("");
  const [page, setPage] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filters, setFilters] = useState<{ actions: string[]; resource_types: string[] }>({
    actions: [],
    resource_types: [],
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.actionLogs.list({
        search: search || undefined,
        action: action || undefined,
        resource_type: resourceType || undefined,
        skip: page * PAGE_SIZE,
        limit: PAGE_SIZE,
      });
      setItems(data.items);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, [search, action, resourceType, page]);

  useEffect(() => {
    if (!isAdmin) {
      router.push("/dashboard");
      return;
    }
    api.actionLogs.filters().then(setFilters).catch(() => {});
  }, [isAdmin, router]);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  if (!isAdmin) return null;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Action Logs</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 4 }}>
            Audit trail of user actions across the system
          </p>
        </div>
      </div>

      <div className="card" style={{ padding: 14, marginBottom: 14 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <div style={{ position: "relative", flex: "1 1 220px", minWidth: 200 }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
            <input
              className="input"
              style={{ paddingLeft: 32 }}
              placeholder="Search user, action, resource…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            />
          </div>
          <select className="input" style={{ width: 160 }} value={action} onChange={(e) => { setAction(e.target.value); setPage(0); }}>
            <option value="">All actions</option>
            {filters.actions.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select className="input" style={{ width: 180 }} value={resourceType} onChange={(e) => { setResourceType(e.target.value); setPage(0); }}>
            <option value="">All resources</option>
            {filters.resource_types.map((r) => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
          </select>
        </div>
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        {loading ? (
          <div className="spinner-center" style={{ padding: 40 }}><span className="spinner spinner-lg" /></div>
        ) : items.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>No action logs found</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 32 }} />
                  <th>When</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Resource</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {items.map((log) => {
                  const open = expandedId === log.id;
                  return (
                    <Fragment key={log.id}>
                      <tr style={{ cursor: "pointer" }} onClick={() => setExpandedId(open ? null : log.id)}>
                        <td>{open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
                        <td style={{ whiteSpace: "nowrap" }}>{new Date(log.created_at).toLocaleString("en-IN")}</td>
                        <td>
                          <div style={{ fontWeight: 500 }}>{log.user_name || "—"}</div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{log.user_email || "—"}</div>
                        </td>
                        <td>
                          <span className="badge badge-gray">{log.action}</span>
                          <div style={{ fontSize: 12, marginTop: 4 }}>{actionLabel(log.action, log.resource_type)}</div>
                        </td>
                        <td>
                          <div>{log.resource_label || log.resource_id || "—"}</div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{log.resource_type.replace(/_/g, " ")}</div>
                        </td>
                        <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{log.ip_address || "—"}</td>
                      </tr>
                      {open && (
                        <tr>
                          <td colSpan={6} style={{ background: "var(--bg)", padding: 14 }}>
                            <ChangesBlock details={log.details} />
                            {log.user_agent && (
                              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 10 }}>
                                User agent: {log.user_agent}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && total > PAGE_SIZE && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", borderTop: "1px solid var(--border)" }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-secondary btn-sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</button>
              <button className="btn btn-secondary btn-sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
