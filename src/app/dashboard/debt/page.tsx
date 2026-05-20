import styles from "../tables.module.css";
import SecurityModals from "@/components/modals/SecurityModals";
import DeleteButton from "@/components/modals/DeleteButton";
import DataTableFilter from "@/components/ui/DataTableFilter";
import ColumnFilter from "@/components/ui/ColumnFilter";
import { companies, filterPositions } from "@/lib/mock-data";

type SearchParams = Record<string, string | undefined>;

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { q, filter, f_company, f_class, f_holder, f_pan } = await searchParams;
  const positions = filterPositions("DEBT", { q, filter, f_company, f_class, f_holder, f_pan });
  const companyFilterOpts = companies.map((c) => ({ label: c.name, value: c.id }));
  const raw = filterPositions("DEBT", {});
  const uniqCompanies = Array.from(new Set(raw.map((p) => p.security.company.name)));
  const uniqClasses = Array.from(new Set(raw.map((p) => p.security.class)));
  const uniqHolders = Array.from(new Set(raw.map((p) => p.shareholder.primaryName)));
  const uniqPans = Array.from(new Set(raw.map((p) => p.shareholder.pan)));

  return (
    <div className="flex-col gap-6">
      <header className="flex justify-between items-center mb-4">
        <div><h2>Debenture Register</h2><p className="text-sub">Beneficiary position register.</p></div>
        <div className="flex gap-4 items-center">
          <DataTableFilter searchPlaceholder="Search..." filterOptions={companyFilterOpts} />
          <SecurityModals companies={companies} defaultType="DEBT" />
        </div>
      </header>
      <div className={`${styles.tableWrapper} glass-panel animate-in`}>
        <table className={styles.dataTable}>
          <thead><tr>
            <th>Company <ColumnFilter columnKey="company" options={uniqCompanies} /></th>
            <th>Class <ColumnFilter columnKey="class" options={uniqClasses} /></th>
            <th>Holder <ColumnFilter columnKey="holder" options={uniqHolders} /></th>
            <th>PAN <ColumnFilter columnKey="pan" options={uniqPans} /></th>
            <th>Shares</th><th>Action</th>
          </tr></thead>
          <tbody>
            {positions.length === 0 ? (
              <tr><td colSpan={6} className={styles.emptyState}>No records found.</td></tr>
            ) : positions.map((pos) => (
              <tr key={pos.id}>
                <td>{pos.security.company.name}</td>
                <td>{pos.security.class}</td>
                <td><strong>{pos.shareholder.primaryName}</strong></td>
                <td className={styles.monoCell}>{pos.shareholder.pan}</td>
                <td className={styles.sharesCell}>{pos.sharesCount.toLocaleString()}</td>
                <td><DeleteButton id={pos.id} type="POSITION" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
