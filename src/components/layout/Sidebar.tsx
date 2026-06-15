"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Building2, Users, LayoutDashboard, LogOut, ChevronRight, UserCheck, FileText, Mail, Receipt } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
}

const nav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: <LayoutDashboard size={16} /> },
  { href: "/dashboard/companies", label: "Companies", icon: <Building2 size={16} /> },
  { href: "/dashboard/beneficiaries", label: "Beneficiaries", icon: <UserCheck size={16} /> },
  { href: "/dashboard/reports", label: "Reports", icon: <FileText size={16} /> },
  { href: "/dashboard/invoices", label: "Tax Invoices", icon: <Receipt size={16} /> },
  { href: "/dashboard/emails", label: "Email", icon: <Mail size={16} /> },
  { href: "/dashboard/users", label: "Users", icon: <Users size={16} />, adminOnly: true },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout, isAdmin } = useAuth();

  const items = nav.filter((i) => !i.adminOnly || isAdmin);

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <h1>Harmilap RTA</h1>
        <p>Office Management</p>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section">
          {items.map((item) => {
            const active = item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} className={`nav-item ${active ? "active" : ""}`}>
                {item.icon}
                {item.label}
                {active && <ChevronRight size={14} style={{ marginLeft: "auto", opacity: .4 }} />}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="sidebar-footer">
        <div style={{ padding: "8px 12px 10px", fontSize: 12 }}>
          <div style={{ fontWeight: 600, color: "var(--text)" }}>{user?.name}</div>
          <div style={{ color: "var(--text-muted)", marginTop: 1 }}>
            {user?.role === "admin" ? "Administrator" : "User"} · {user?.email}
          </div>
        </div>
        <button className="nav-item" onClick={logout} style={{ color: "var(--danger)", width: "100%" }}>
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
