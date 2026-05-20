import styles from "../tables.module.css";
import BillingModals from "@/components/modals/BillingModals";
import DeleteButton from "@/components/modals/DeleteButton";
import DataTableFilter from "@/components/ui/DataTableFilter";
import ColumnFilter from "@/components/ui/ColumnFilter";
import InvoiceDownloadButton from "@/components/ui/InvoiceDownloadButton";
import { companies, filterInvoices, invoices } from "@/lib/mock-data";

type SearchParams = Record<string, string | undefined>;

export default async function BillingPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { q, filter, f_invoiceNo, f_company } = await searchParams;
  const filtered = filterInvoices({ q, filter, f_invoiceNo, f_company });
  const companyFilterOpts = companies.map((c) => ({ label: c.name, value: c.id }));
  const uniqInvoices = Array.from(new Set(invoices.map((i) => i.invoiceNo)));
  const uniqCompanies = Array.from(new Set(invoices.map((i) => i.company.name)));

  return (
    <div className="flex-col gap-6">
      <header className="flex justify-between items-center mb-4">
        <div><h2>Billing & Invoices</h2><p className="text-sub">Manage RTA Service Fees (SAC Code 9971) and Pass-through charges.</p></div>
        <div className="flex gap-4 items-center">
          <DataTableFilter searchPlaceholder="Search Invoice No..." filterOptions={companyFilterOpts} />
          <BillingModals companies={companies} />
        </div>
      </header>
      <div className={`${styles.tableWrapper} glass-panel animate-in`}>
        <table className={styles.dataTable}>
          <thead><tr>
            <th>Invoice No <ColumnFilter columnKey="invoiceNo" options={uniqInvoices} /></th>
            <th>Company <ColumnFilter columnKey="company" options={uniqCompanies} /></th>
            <th>Date</th><th>Due Date</th>
            <th>Amount (excl. GST)</th><th>GST</th><th>Amount (incl. GST)</th><th>Status</th><th>Action</th>
          </tr></thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={9} className={styles.emptyState}>No invoices generated yet.</td></tr>
            ) : filtered.map((inv) => (
              <tr key={inv.id}>
                <td className={styles.monoCell}>{inv.invoiceNo}</td>
                <td>{inv.company.name}</td>
                <td>{inv.date.toLocaleDateString()}</td>
                <td className="text-danger">{inv.dueDate?.toLocaleDateString() || "-"}</td>
                <td className={styles.numericCell}><strong>₹{inv.totalAmount.toLocaleString()}</strong></td>
                <td className={styles.numericCell}>₹{inv.gstAmount.toLocaleString()}</td>
                <td className={styles.numericCell}>₹{inv.totalAmountInclGst.toLocaleString()}</td>
                <td><span className="text-warning">{inv.status}</span></td>
                <td className={styles.actionCell}>
                  <div className={styles.actionsGroup}>
                    <InvoiceDownloadButton
                      invoiceNo={inv.invoiceNo}
                      companyName={inv.company.name}
                      date={inv.date.toLocaleDateString()}
                      dueDate={inv.dueDate?.toLocaleDateString() || "-"}
                      totalAmount={inv.totalAmount}
                      gstRate={inv.gstRate}
                      gstAmount={inv.gstAmount}
                      totalAmountInclGst={inv.totalAmountInclGst}
                      lineItems={inv.lineItems.map((line) => ({ code: line.code, description: line.description, amount: line.amount }))}
                    />
                    <DeleteButton id={inv.id} type="INVOICE" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
