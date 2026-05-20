import Link from "next/link";
import styles from "./layout.module.css";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={styles.appContainer}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h3>RTA Portal</h3>
          <span className={styles.capsuleBadge}>DEMO</span>
        </div>

        <nav className={styles.navLinks}>
          <Link href="/dashboard" className={styles.navItem}>Home / Dashboard</Link>
          <Link href="/dashboard/profile" className={styles.navItem}>Profile</Link>
          <Link href="/dashboard/companies" className={styles.navItem}>Companies</Link>
          <Link href="/dashboard/capital-structure" className={styles.navItem}>Capital Structure</Link>
          <Link href="/dashboard/beneficiary-position" className={styles.navItem}>Beneficiary Position</Link>
          <Link href="/dashboard/corporate-actions" className={styles.navItem}>Corporate Action Tracking</Link>
          <Link href="/dashboard/reconciliation" className={styles.navItem}>Reconciliation Report</Link>
          <Link href="/dashboard/billing" className={styles.navItem}>Billing & Invoice</Link>
          <Link href="/dashboard/requests" className={styles.navItem}>Online Requests / Downloads</Link>
          <Link href="/dashboard/reports" className={styles.navItem}>Reports</Link>
          <Link href="/dashboard/share-capital-report" className={styles.navItem}>Share Capital Reports (Bulk)</Link>
          <Link href="/dashboard/admin/roles" className={styles.navItemAdmin}>RBAC / Users</Link>
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.userInfo}>
            <span className={styles.userName}>Demo User</span>
            <span className={styles.userRole}>Frontend Preview</span>
          </div>
        </div>
      </aside>

      <main className={styles.mainContent}>
        {children}
      </main>
    </div>
  );
}
