import ReportsClient from "@/components/modals/ReportsClient";

export default function ReconciliationPage() {
  return (
    <div className="flex-col gap-6">
      <header className="mb-4">
        <h2>Reconciliation Report</h2>
        <p className="text-sub">Detailed, summary, and downloadable reconciliation outputs by as-on date.</p>
      </header>
      <ReportsClient />
    </div>
  );
}
