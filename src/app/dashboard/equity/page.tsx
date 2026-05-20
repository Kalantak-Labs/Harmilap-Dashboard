import styles from "../tables.module.css";
import pageStyles from "./page.module.css";
import SecurityModals from "@/components/modals/SecurityModals";
import DeleteButton from "@/components/modals/DeleteButton";
import DataTableFilter from "@/components/ui/DataTableFilter";
import ColumnFilter from "@/components/ui/ColumnFilter";
import { companies, filterPositions } from "@/lib/mock-data";

type SearchParams = Record<string, string | undefined>;

export default async function EquityPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { q, filter, f_company, f_class, f_holder, f_pan, f_depository } = await searchParams;
  const positions = filterPositions("EQUITY", { q, filter, f_company, f_class, f_holder, f_pan, f_depository });
  const companyFilterOpts = companies.map((c) => ({ label: c.name, value: c.id }));
  const rawPositions = filterPositions("EQUITY", {});
  const uniqCompanies = Array.from(new Set(rawPositions.map((p) => p.security.company.name)));
  const uniqClasses = Array.from(new Set(rawPositions.map((p) => p.security.class)));
  const uniqHolders = Array.from(new Set(rawPositions.map((p) => p.shareholder.primaryName)));
  const uniqPans = Array.from(new Set(rawPositions.map((p) => p.shareholder.pan)));
  const uniqDepos = Array.from(new Set(rawPositions.map((p) => p.depository)));
  const dematTotal = positions.filter((p) => p.depository !== "PHYSICAL").reduce((sum, p) => sum + p.sharesCount, 0);
  const physicalTotal = positions.filter((p) => p.depository === "PHYSICAL").reduce((sum, p) => sum + p.sharesCount, 0);
  const grandTotal = dematTotal + physicalTotal;

  return (
    <div className="flex-col gap-6">
      <header className="flex justify-between items-center mb-4">
        <div>
          <h2>Equity Register (Beneficiary Position)</h2>
          <p className="text-sub">Tracks FPU and PPU Demat (NSDL/CDSL) and Physical holdings.</p>
        </div>
        <div className="flex gap-4 items-center">
          <DataTableFilter searchPlaceholder="Search Name, PAN, Folio..." filterOptions={companyFilterOpts} />
          <div className="flex gap-2">
            <button className="btn-primary" style={{ background: "var(--bg-secondary)", color: "var(--text-primary)" }}>Download Report</button>
            <SecurityModals companies={companies} defaultType="EQUITY" />
          </div>
        </div>
      </header>
      <div className={pageStyles.summaryCards}>
        <div className={`${pageStyles.card} glass-panel`}><span>Demat Total</span><h3>{dematTotal.toLocaleString()}</h3></div>
        <div className={`${pageStyles.card} glass-panel`}><span>Physical Total</span><h3>{physicalTotal.toLocaleString()}</h3></div>
        <div className={`${pageStyles.card} glass-panel`}><span>Grand Total</span><h3>{grandTotal.toLocaleString()}</h3></div>
      </div>
      <div className={`${styles.tableWrapper} glass-panel animate-in`}>
        <table className={styles.dataTable}>
          <thead>
            <tr>
              <th className={styles.headerWithFilter}>Company <ColumnFilter columnKey="company" options={uniqCompanies} /></th>
              <th className={styles.headerWithFilter}>Class <ColumnFilter columnKey="class" options={uniqClasses} /></th>
              <th className={styles.headerWithFilter}>Holder Name <ColumnFilter columnKey="holder" options={uniqHolders} /></th>
              <th className={styles.headerWithFilter}>PAN <ColumnFilter columnKey="pan" options={uniqPans} /></th>
              <th>Joint Holder</th><th>PAN (2nd)</th>
              <th className={styles.headerWithFilter}>Depository <ColumnFilter columnKey="depository" options={uniqDepos} /></th>
              <th>DP ID/Client ID/Folio</th><th className={styles.sharesCell}>Shares</th><th className={styles.actionCellNarrow}>Action</th>
            </tr>
          </thead>
          <tbody>
            {positions.length === 0 ? (
              <tr><td colSpan={10} className={styles.emptyState}>No beneficiary records found.</td></tr>
            ) : (
              positions.map((pos) => (
                <tr key={pos.id}>
                  <td>{pos.security.company.name}</td>
                  <td>{pos.security.class} {pos.security.isFullyPaid ? "(FPU)" : "(PPU)"}</td>
                  <td><strong>{pos.shareholder.primaryName}</strong></td>
                  <td className={styles.monoCell}>{pos.shareholder.pan}</td>
                  <td>{pos.shareholder.jointName || "-"}</td>
                  <td className={styles.monoCell}>{pos.shareholder.jointPan || "-"}</td>
                  <td>{pos.depository}</td>
                  <td className={styles.monoWrapCell}>{pos.depository === "PHYSICAL" ? pos.folio : `${pos.dpId} / ${pos.clientId}`}</td>
                  <td className={`${styles.numericCell} ${styles.sharesCell}`}><strong>{pos.sharesCount.toLocaleString()}</strong></td>
                  <td className={styles.actionCellNarrow}><DeleteButton id={pos.id} type="POSITION" /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
