import ReportsClient from "@/components/modals/ReportsClient";

export default function ReportsPage() {
  return (
    <div className="flex-col gap-6">
      <header className="mb-4">
        <h2>Reporting Engine</h2>
        <p className="text-sub">Generate Reconciliation, Beneficiary, and comparison outputs.</p>
      </header>
      <ReportsClient />
    </div>
  );
}
