"use client";

import { useState } from "react";

type RequestStatus = "PENDING" | "REJECTED" | "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CLOSED";

export default function RequestStatusSelect({ id, status }: { id: string; status: RequestStatus }) {
  const [value, setValue] = useState(status);
  return (
    <select className="input-field" style={{ minWidth: "130px", padding: "0.45rem 0.6rem" }}
      value={value} onChange={(e) => setValue(e.target.value as RequestStatus)}>
      <option value="OPEN">OPEN</option>
      <option value="PENDING">PENDING</option>
      <option value="IN_PROGRESS">IN PROGRESS</option>
      <option value="REJECTED">REJECTED</option>
      <option value="COMPLETED">COMPLETED</option>
      <option value="CLOSED">CLOSED</option>
    </select>
  );
}
