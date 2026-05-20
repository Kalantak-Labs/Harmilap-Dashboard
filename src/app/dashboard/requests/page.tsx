import styles from "../tables.module.css";
import RequestModals from "@/components/modals/RequestModals";
import RequestStatusSelect from "@/components/ui/RequestStatusSelect";
import TemplateDownloads from "@/components/ui/TemplateDownloads";
import { companies, onlineRequests } from "@/lib/mock-data";

export default function RequestsPage() {
  return (
    <div className="flex-col gap-6">
      <header className="flex justify-between items-center mb-4">
        <div><h2>Online Requests / Downloads</h2><p className="text-sub">Operational requests and preferred output formats.</p></div>
        <RequestModals companies={companies} />
      </header>
      <div className="glass-panel p-4">
        <h3>Download Formats</h3>
        <p className="text-sub mt-2 mb-4">Download templates in PDF, Excel, and Word formats.</p>
        <TemplateDownloads />
      </div>
      <div className={`${styles.tableWrapper} glass-panel animate-in`}>
        <table className={styles.dataTable}>
          <thead><tr>
            <th>Company</th><th>Request Type</th><th>Title</th><th>Status</th>
            <th>Requested By</th><th>Format</th><th>Communication</th><th>Created</th>
          </tr></thead>
          <tbody>
            {onlineRequests.length === 0 ? (
              <tr><td colSpan={8} className={styles.emptyState}>No online requests found.</td></tr>
            ) : onlineRequests.map((request) => (
              <tr key={request.id}>
                <td>{request.company.name}</td>
                <td>{request.type}</td>
                <td>{request.title}</td>
                <td><RequestStatusSelect id={request.id} status={request.status} /></td>
                <td>{request.requestedBy}</td>
                <td>{request.preferredFormat || "-"}</td>
                <td>
                  <a className={styles.actionLink}
                    href={`mailto:${request.company.emailId1 || "operations@harmilap.com"}?subject=RTA Request: ${encodeURIComponent(request.title)}`}>
                    Email Client
                  </a>
                </td>
                <td>{request.createdAt.toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
