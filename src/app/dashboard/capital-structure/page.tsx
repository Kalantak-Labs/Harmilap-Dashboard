import styles from "../tables.module.css";
import CapitalStructureModals from "@/components/modals/CapitalStructureModals";
import { capitalClasses, companies } from "@/lib/mock-data";

export default function CapitalStructurePage() {
  return (
    <div className="flex-col gap-6">
      <header className="flex justify-between items-center mb-4">
        <div><h2>Capital Structure</h2><p className="text-sub">Class setup, face value, shares, and distinctive range tracking.</p></div>
        <CapitalStructureModals companies={companies} />
      </header>
      <div className={`${styles.tableWrapper} glass-panel animate-in`}>
        <table className={styles.dataTable}>
          <thead><tr>
            <th>Company</th><th>Security Type</th><th>Class</th><th>Face Value</th>
            <th>No. of Shares</th><th>Distinctive From</th><th>Distinctive To</th>
          </tr></thead>
          <tbody>
            {capitalClasses.length === 0 ? (
              <tr><td colSpan={7} className={styles.emptyState}>No capital structure rows found.</td></tr>
            ) : capitalClasses.map((row) => (
              <tr key={row.id}>
                <td>{row.company.name}</td>
                <td>{row.securityType}</td>
                <td>{row.className}</td>
                <td className={styles.numericCell}>₹{row.faceValue.toLocaleString()}</td>
                <td className={styles.numericCell}>{row.numberOfShares.toLocaleString()}</td>
                <td className={styles.monoCell}>{row.distinctiveNumberFrom.toString()}</td>
                <td className={styles.monoCell}>{row.distinctiveNumberTo.toString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
