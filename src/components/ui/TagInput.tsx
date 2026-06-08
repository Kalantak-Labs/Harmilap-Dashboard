"use client";

import { useState, KeyboardEvent } from "react";
import { X } from "lucide-react";

interface Props {
  values: string[];
  onChange: (vals: string[]) => void;
  placeholder?: string;
}

export default function TagInput({ values, onChange, placeholder = "Type and press Enter" }: Props) {
  const [input, setInput] = useState("");

  const add = () => {
    const v = input.trim();
    if (v && !values.includes(v)) onChange([...values, v]);
    setInput("");
  };

  const remove = (i: number) => onChange(values.filter((_, idx) => idx !== i));

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); add(); }
    if (e.key === "Backspace" && !input && values.length) remove(values.length - 1);
  };

  return (
    <div className="tag-input-wrap" style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "6px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "var(--surface)", cursor: "text" }}>
      {values.map((v, i) => (
        <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 999, fontSize: 12 }}>
          {v}
          <button type="button" onClick={() => remove(i)} style={{ display: "flex", opacity: .6 }}><X size={12} /></button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={onKey}
        onBlur={add}
        placeholder={values.length === 0 ? placeholder : ""}
        style={{ border: "none", outline: "none", background: "transparent", fontSize: 13, flex: 1, minWidth: 120 }}
      />
    </div>
  );
}
