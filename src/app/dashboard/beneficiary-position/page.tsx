import Link from "next/link";
import { sumSharesByType } from "@/lib/mock-data";

export default function BeneficiaryPositionPage() {
  const cards = [
    { title: "Equity Beneficiary Position", href: "/dashboard/equity", value: sumSharesByType("EQUITY") },
    { title: "Preference Beneficiary Position", href: "/dashboard/pref", value: sumSharesByType("PREFERENCE") },
    { title: "Debenture Beneficiary Position", href: "/dashboard/debt", value: sumSharesByType("DEBT") },
  ];
  return (
    <div className="flex-col gap-6">
      <header className="mb-4">
        <h2>Beneficiary Position</h2>
        <p className="text-sub">Track ISIN-wise holdings across all security classes.</p>
      </header>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1rem" }}>
        {cards.map((card) => (
          <Link key={card.href} href={card.href} className="glass-panel p-6 animate-in">
            <h3>{card.title}</h3>
            <p className="text-sub mt-2">Total Shares</p>
            <p style={{ fontSize: "2rem", fontWeight: 700, marginTop: "0.25rem" }}>{card.value.toLocaleString()}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
