import Link from "next/link";
import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.main}>
      <div className={`${styles.glassCard} animate-in`}>
        <div className={styles.header}>
          <h1>Harmilap Share Transfer Agents</h1>
          <p className="text-sub">Registrar & Transfer Agent (RTA) | Back Office System</p>
        </div>

        <div className={styles.body}>
          <p>
            Welcome to the digital platform built for Harmilap Share Transfer Agents, located in
            Indra Nagar, near Azadpur Mandi, Delhi. This system manages share records, corporate
            actions, depository interfaces, and SEBI compliance.
          </p>
          <div className={styles.disclaimer}>
            <strong>Disclaimer:</strong> This is the Back Office Management Version. For Issuer Client
            Companies, use ISIN + RTA User ID. For Shareholders, use PAN Card + Folio Number.
          </div>
        </div>

        <div className={styles.actions}>
          <Link href="/dashboard" className="btn-primary w-full" style={{ textAlign: "center" }}>
            Open Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
