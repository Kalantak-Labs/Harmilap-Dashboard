import ShareCapitalReportForm from "@/components/reports/ShareCapitalReportForm";

export default function ShareCapitalReportPage() {
  return (
    <div className="flex-col gap-6">
      <header className="mb-2">
        <h2>Share Capital Reconciliation Report</h2>
        <p className="text-sub">
          Upload an Excel file to generate share capital reconciliation PDFs in bulk. Download the
          sample template, set report dates, and get a ZIP of all reports.
        </p>
      </header>
      <ShareCapitalReportForm />
    </div>
  );
}
