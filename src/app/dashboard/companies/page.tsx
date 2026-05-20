import styles from "../tables.module.css";
import Link from "next/link";
import CompanyModals from "@/components/modals/CompanyModals";
import DeleteButton from "@/components/modals/DeleteButton";
import DataTableFilter from "@/components/ui/DataTableFilter";
import ColumnFilter from "@/components/ui/ColumnFilter";
import { companies, filterCompanies } from "@/lib/mock-data";

type SearchParams = Record<string, string | undefined>;

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { q, f_cin, f_name, f_pan, f_gst } = await searchParams;
  const filtered = filterCompanies({ q, f_cin, f_name, f_pan, f_gst });

  const uniqCins = Array.from(new Set(companies.map((c) => c.cin)));
  const uniqNames = Array.from(new Set(companies.map((c) => c.name)));
  const uniqPans = Array.from(new Set(companies.map((c) => c.pan).filter(Boolean))) as string[];
  const uniqGsts = Array.from(new Set(companies.map((c) => c.gst).filter(Boolean))) as string[];

  return (
    <div className="flex-col gap-6">
      <header className="flex justify-between items-center mb-4">
        <div>
          <h2>Company Profiles (Master)</h2>
          <p className="text-sub">Manage Issuer Client Companies, CINs, and Contact Details.</p>
        </div>
        <div className="flex gap-4">
          <DataTableFilter searchPlaceholder="Global Search..." />
          <CompanyModals />
        </div>
      </header>

      <div className={`${styles.tableWrapper} glass-panel animate-in`}>
        <table className={styles.dataTable}>
          <thead>
            <tr>
              <th className={styles.headerWithFilter}>CIN <ColumnFilter columnKey="cin" options={uniqCins} /></th>
              <th className={styles.headerWithFilter}>Company Name <ColumnFilter columnKey="name" options={uniqNames} /></th>
              <th>Date of Incorp</th>
              <th className={styles.headerWithFilter}>PAN <ColumnFilter columnKey="pan" options={uniqPans} /></th>
              <th className={styles.headerWithFilter}>GST <ColumnFilter columnKey="gst" options={uniqGsts} /></th>
              <th>Auth Person</th>
              <th className={styles.actionCell}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className={styles.emptyState}>No client companies found.</td>
              </tr>
            ) : (
              filtered.map((company) => (
                <tr key={company.id}>
                  <td className={styles.monoCell}>{company.cin}</td>
                  <td><strong>{company.name}</strong></td>
                  <td>{company.dateOfIncorporation.toLocaleDateString()}</td>
                  <td className={styles.monoCell}>{company.pan || "-"}</td>
                  <td className={styles.monoCell}>{company.gst || "-"}</td>
                  <td>{company.authPersonName || "-"}</td>
                  <td className={styles.actionCell}>
                    <div className={styles.actionsGroup}>
                      <Link
                        href={`/dashboard/companies/${company.id}`}
                        className={styles.editIconAction}
                        aria-label="Edit company profile"
                        title="Edit profile"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                        </svg>
                      </Link>
                      <DeleteButton id={company.id} type="COMPANY" />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
