import Link from "next/link";
import { companies } from "@/lib/mock-data";

export default function ProfilePage() {
  const company = companies[0];
  return (
    <div className="flex-col gap-6">
      <header className="flex justify-between items-center mb-4">
        <div><h2>Profile</h2><p className="text-sub">User profile and issuer compliance snapshot.</p></div>
        <Link href="/dashboard/companies" className="btn-primary btn-neutral">Open Company Master</Link>
      </header>
      <div className="glass-panel p-6 animate-in">
        <h3>User Details</h3>
        <div className="mt-4 flex-col gap-2">
          <p><strong>Username:</strong> demo</p>
          <p><strong>User Type:</strong> ADMIN</p>
          <p><strong>Role:</strong> Frontend Preview</p>
        </div>
      </div>
      <div className="glass-panel p-6 animate-in">
        <h3>Issuer Compliance Snapshot</h3>
        <div className="mt-4" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem 1.5rem" }}>
          <p><strong>CIN:</strong> {company.cin}</p>
          <p><strong>Company:</strong> {company.name}</p>
          <p><strong>Date of Incorporation:</strong> {company.dateOfIncorporation.toLocaleDateString()}</p>
          <p><strong>PAN:</strong> {company.pan || "-"}</p>
          <p><strong>GST:</strong> {company.gst || "-"}</p>
          <p><strong>RTA Code:</strong> {company.rtaCode || "-"}</p>
          <p><strong>Auth Person:</strong> {company.authPersonName || "-"}</p>
          <p><strong>Email:</strong> {company.emailId1 || "-"}</p>
        </div>
      </div>
    </div>
  );
}
