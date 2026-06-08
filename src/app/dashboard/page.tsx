"use client";

import { useEffect, useState } from "react";
import { Building2, Shield, TrendingUp } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import Link from "next/link";

export default function DashboardPage() {
  const { user } = useAuth();
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    api.companies.count().then((r) => setCount(r.count)).catch(() => {});
  }, []);

  return (
    <div>
      <div className="page-header">
        <h2>Dashboard</h2>
        <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>
          Welcome back, <strong>{user?.name}</strong>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-card-label">Companies</div>
          <div className="stat-card-value">{count ?? "—"}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
        <Link href="/dashboard/companies" style={{ textDecoration: "none" }}>
          <div className="card" style={{ padding: 20, cursor: "pointer", transition: "box-shadow var(--transition)" }}
            onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "var(--shadow)")}
            onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "")}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: 8, display: "flex" }}>
                <Building2 size={18} />
              </div>
              <div>
                <div style={{ fontWeight: 600 }}>Companies</div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>View, filter and manage client companies</div>
              </div>
            </div>
          </div>
        </Link>

        {user?.role === "admin" && (
          <Link href="/dashboard/users" style={{ textDecoration: "none" }}>
            <div className="card" style={{ padding: 20, cursor: "pointer", transition: "box-shadow var(--transition)" }}
              onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "var(--shadow)")}
              onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "")}>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: 8, display: "flex" }}>
                  <Shield size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: 600 }}>User Management</div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>Create users and assign permissions</div>
                </div>
              </div>
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}
