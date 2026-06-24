"use client";

import { useEffect, useRef, useState } from "react";
import { Filter } from "lucide-react";

export type ColumnFilterKind = "text" | "bool";

/** Excel-style per-column filter button rendered inside a table header cell.
 * Server-side: the value is lifted to the page, which sends it to the API. */
export function ColumnFilter({
  label,
  value,
  onChange,
  kind = "text",
  boolLabels,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  kind?: ColumnFilterKind;
  boolLabels?: { true: string; false: string };
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const active = value != null && String(value).trim() !== "";

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <span ref={ref} style={{ position: "relative", display: "inline-flex", verticalAlign: "middle", marginLeft: 4 }}>
      <button
        type="button"
        title={`Filter ${label}`}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        style={{
          border: "none", background: active ? "var(--primary, #2563eb)" : "transparent",
          cursor: "pointer", padding: 2, lineHeight: 0, borderRadius: 4,
          color: active ? "#fff" : "var(--text-muted)",
        }}
      >
        <Filter size={11} fill={active ? "currentColor" : "none"} />
      </button>
      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute", top: "100%", left: 0, zIndex: 60, marginTop: 6,
            background: "var(--card, #fff)", border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm, 6px)", boxShadow: "0 6px 20px rgba(0,0,0,0.14)",
            padding: 8, minWidth: 190, textTransform: "none", fontWeight: 400,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>
            Filter · {label}
          </div>
          {kind === "bool" ? (
            <select className="input input-sm" style={{ width: "100%" }} value={value} autoFocus
              onChange={(e) => onChange(e.target.value)}>
              <option value="">All</option>
              <option value="true">{boolLabels?.true ?? "Yes"}</option>
              <option value="false">{boolLabels?.false ?? "No"}</option>
            </select>
          ) : (
            <input className="input input-sm" style={{ width: "100%" }} autoFocus placeholder="Contains…"
              value={value} onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") setOpen(false); }} />
          )}
          {active && (
            <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 6, width: "100%" }}
              onClick={() => onChange("")}>Clear</button>
          )}
        </div>
      )}
    </span>
  );
}
