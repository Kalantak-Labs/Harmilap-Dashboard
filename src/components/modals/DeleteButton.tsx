"use client";

import { useState } from "react";

export default function DeleteButton({ id, type }: { id: string; type: "COMPANY" | "USER" | "POSITION" | "ACTION" | "INVOICE" }) {
  const [isLoading, setIsLoading] = useState(false);

  const handleDelete = () => {
    if (!window.confirm("Delete this record? (Demo mode — not persisted)")) return;
    setIsLoading(true);
    setIsLoading(false);
  };

  return (
    <button onClick={handleDelete} disabled={isLoading} aria-label="Delete" title="Delete"
      style={{ color: "var(--danger)", width: "1.8rem", height: "1.8rem", borderRadius: "6px",
        border: "1px solid rgba(220, 38, 38, 0.25)", background: "transparent", display: "inline-flex",
        alignItems: "center", justifyContent: "center", cursor: isLoading ? "not-allowed" : "pointer", opacity: isLoading ? 0.6 : 1 }}>
      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
      </svg>
    </button>
  );
}
