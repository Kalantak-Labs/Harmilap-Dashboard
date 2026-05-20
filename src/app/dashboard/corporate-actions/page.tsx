import styles from "../tables.module.css";
import ActionModals from "@/components/modals/ActionModals";
import DeleteButton from "@/components/modals/DeleteButton";
import DataTableFilter from "@/components/ui/DataTableFilter";
import ColumnFilter from "@/components/ui/ColumnFilter";
import { corporateActions, filterCorporateActions, getSecuritiesWithCompany } from "@/lib/mock-data";

type SearchParams = Record<string, string | undefined>;

export default async function CorporateActionsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { q, filter, f_company, f_isin } = await searchParams;
  const actions = filterCorporateActions({ q, filter, f_company, f_isin });
  const securities = getSecuritiesWithCompany();
  const companies = Array.from(new Map(securities.map((s) => [s.companyId, s.company])).values());
  const companyFilterOpts = companies.map((c) => ({ label: c.name, value: c.id }));
  const raw = corporateActions;
  const uniqCompanies = Array.from(new Set(raw.map((p) => p.security.company.name)));
  const uniqIsins = Array.from(new Set(raw.map((p) => p.security.isin)));

  return (
    <div className="flex-col gap-6">
      <header className="flex justify-between items-center mb-4">
        <div><h2>Corporate Action Track Report</h2><p className="text-sub">Allotments, Rights Issues, and Buybacks.</p></div>
        <div className="flex gap-4 items-center">
          <DataTableFilter searchPlaceholder="Search by ISIN..." filterOptions={companyFilterOpts} />
          <ActionModals securities={securities} />
        </div>
      </header>
      <div className={`${styles.tableWrapper} glass-panel animate-in`}>
        <table className={styles.dataTable}>
          <thead><tr>
            <th>Company <ColumnFilter columnKey="company" options={uniqCompanies} /></th>
            <th>ISIN <ColumnFilter columnKey="isin" options={uniqIsins} /></th>
            <th>Allotment</th><th>NSDL</th><th>CDSL</th><th>Physical</th>
            <th>Tot. Shares</th><th>Tot. Value</th><th>Action</th>
          </tr></thead>
          <tbody>
            {actions.length === 0 ? (
              <tr><td colSpan={9} className={styles.emptyState}>No corporate actions found.</td></tr>
            ) : actions.map((act) => (
              <tr key={act.id}>
                <td>{act.security.company.name}</td>
                <td className={styles.monoCell}>{act.security.isin}</td>
                <td>{act.allotmentDate.toLocaleDateString()}</td>
                <td>{act.nsdlHolders}</td><td>{act.cdslHolders}</td><td>{act.physicalHolders}</td>
                <td>{act.totalShares.toLocaleString()}</td>
                <td><strong>₹{act.totalValue.toLocaleString()}</strong></td>
                <td><DeleteButton id={act.id} type="ACTION" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
