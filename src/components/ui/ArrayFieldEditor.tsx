"use client";

import { Plus, X } from "lucide-react";

interface Props {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  inputType?: string;
}

export default function ArrayFieldEditor({ values, onChange, placeholder, inputType = "text" }: Props) {
  const add = () => onChange([...values, ""]);
  const remove = (i: number) => onChange(values.filter((_, idx) => idx !== i));
  const update = (i: number, v: string) => onChange(values.map((x, idx) => (idx === i ? v : x)));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {values.map((v, i) => (
        <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            className="input input-sm"
            type={inputType}
            value={v}
            placeholder={placeholder}
            style={{ flex: 1 }}
            onChange={(e) => update(i, e.target.value)}
          />
          <button
            type="button"
            onClick={() => remove(i)}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 26, height: 26, borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)", background: "var(--surface)",
              color: "var(--text-muted)", cursor: "pointer", flexShrink: 0,
            }}
            title="Remove"
          >
            <X size={12} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="btn btn-ghost btn-sm"
        style={{ alignSelf: "flex-start", gap: 4, fontSize: 12 }}
      >
        <Plus size={13} /> Add
      </button>
    </div>
  );
}
