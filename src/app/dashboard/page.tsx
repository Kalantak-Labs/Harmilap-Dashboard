import styles from "./page.module.css";
import { dashboardStats } from "@/lib/mock-data";

export default function DashboardPage() {
  const {
    totalCompanies,
    totalHolders,
    totalActions,
    activeInvoices,
    newCompaniesThisMonth,
    recentCompanies,
    recentActions,
  } = dashboardStats;

  return (
    <div className={styles.dashboardContainer}>
      <header className={styles.header}>
        <h2>Welcome back, Demo User</h2>
        <p className="text-sub">Here is your RTA overview for today.</p>
      </header>

      <section className={styles.statsGrid}>
        <div className={`${styles.statCard} glass-panel animate-in`} style={{ animationDelay: "0.1s" }}>
          <div className={styles.statLabel}>Issuer Companies</div>
          <div className={styles.statValue}>{totalCompanies}</div>
          <div className={styles.statMeta}>
            {newCompaniesThisMonth > 0
              ? `+${newCompaniesThisMonth} this month`
              : "No new companies this month"}
          </div>
        </div>

        <div className={`${styles.statCard} glass-panel animate-in`} style={{ animationDelay: "0.2s" }}>
          <div className={styles.statLabel}>Total Shareholders</div>
          <div className={styles.statValue}>{totalHolders}</div>
          <div className={styles.statMeta}>Registered Profiles</div>
        </div>

        <div className={`${styles.statCard} glass-panel animate-in`} style={{ animationDelay: "0.3s" }}>
          <div className={styles.statLabel}>Total Actions</div>
          <div className={styles.statValue}>{totalActions}</div>
          <div className={styles.statMeta}>Allotments & Issues</div>
        </div>

        <div className={`${styles.statCard} glass-panel animate-in`} style={{ animationDelay: "0.4s" }}>
          <div className={styles.statLabel}>Generated Invoices</div>
          <div className={styles.statValue}>{activeInvoices}</div>
          <div className={styles.statMeta}>Processed Billing</div>
        </div>
      </section>

      <section className={styles.recentActivity}>
        <div className={`${styles.panelCard} glass-panel animate-in`} style={{ animationDelay: "0.5s" }}>
          <h3>Recent System Activity</h3>
          <div className={styles.activityList}>
            {recentCompanies.length === 0 && recentActions.length === 0 && (
              <span className="text-sub">No recent activity.</span>
            )}
            {recentCompanies.map((c) => (
              <div className={styles.activityItem} key={`comp-${c.id}`}>
                <span className={styles.activityDot}></span>
                <div className={styles.activityDetails}>
                  <strong>New Issuer Onboarded</strong>
                  <span className="text-sub">
                    {c.cin} ({c.name})
                  </span>
                </div>
              </div>
            ))}
            {recentActions.map((a) => (
              <div className={styles.activityItem} key={`act-${a.id}`}>
                <span className={styles.activityDot} style={{ background: "var(--warning)" }}></span>
                <div className={styles.activityDetails}>
                  <strong>Corporate Action Executed</strong>
                  <span className="text-sub">
                    {a.totalShares} shares extended on ISIN {a.security.isin}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
