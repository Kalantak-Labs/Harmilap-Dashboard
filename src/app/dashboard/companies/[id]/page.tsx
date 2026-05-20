import { notFound } from "next/navigation";
import Link from "next/link";
import CompanyEditForm from "./CompanyEditForm";
import { getCompanyById } from "@/lib/mock-data";

export default async function CompanyEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const company = getCompanyById(id);
  if (!company) notFound();
  return (
    <div className="flex-col gap-6 w-full" style={{ maxWidth: "800px", margin: "0 auto" }}>
      <header className="flex justify-between items-center mb-4">
        <div><h2>Edit Company Profile: {company.name}</h2><p className="text-sub">Modify CIN, contact details, and addresses.</p></div>
        <Link href="/dashboard/companies" className="btn-primary" style={{ background: "transparent", color: "var(--text-primary)", border: "1px solid var(--text-muted)" }}>Back</Link>
      </header>
      <div className="glass-panel p-6 animate-in"><CompanyEditForm company={company} /></div>
    </div>
  );
}
