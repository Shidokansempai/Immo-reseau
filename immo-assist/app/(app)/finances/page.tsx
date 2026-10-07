import Link from "next/link";
import { requireAuth } from "@/lib/tenant";
import { db } from "@/lib/db";
import { PageHeader, Card, Badge, StatCard } from "@/components/ui";
import { eur } from "@/lib/format";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; tone: any }> = {
  FORECAST: { label: "Prévisionnel", tone: "gold" },
  INVOICED: { label: "Facturé", tone: "blue" },
  PAID: { label: "Encaissé", tone: "green" },
};

export default async function FinancesPage() {
  const s = await requireAuth();
  const commissions = await db.commission.findMany({
    where: { organizationId: s.organizationId },
    include: { property: true },
    orderBy: { createdAt: "desc" },
  });

  const sum = (f: (c: (typeof commissions)[number]) => number) => commissions.reduce((a, c) => a + f(c), 0);
  const caRealized = sum((c) => (c.status === "PAID" ? c.salePrice ?? 0 : 0));
  const caForecast = sum((c) => (c.status !== "PAID" ? c.salePrice ?? 0 : 0));
  const commRealized = sum((c) => (c.status === "PAID" ? c.advisorAmount ?? 0 : 0));
  const commForecast = sum((c) => (c.status !== "PAID" ? c.advisorAmount ?? 0 : 0));

  return (
    <div>
      <PageHeader title="Finances" subtitle="Honoraires, commissions et chiffre d'affaires. Calcul automatique." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="CA encaissé" value={eur(caRealized, { compact: true })} accent="green" />
        <StatCard label="CA prévisionnel" value={eur(caForecast, { compact: true })} accent="gold" />
        <StatCard label="Commissions encaissées" value={eur(commRealized, { compact: true })} accent="green" />
        <StatCard label="Commissions à venir" value={eur(commForecast, { compact: true })} accent="gold" />
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="th">Bien</th>
                <th className="th hidden sm:table-cell">Prix de vente</th>
                <th className="th hidden md:table-cell">Honoraires</th>
                <th className="th">Part conseiller</th>
                <th className="th hidden lg:table-cell">Part agence</th>
                <th className="th">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--border)]">
              {commissions.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="td"><Link href={`/biens/${c.propertyId}`} className="font-medium hover:text-azure truncate block max-w-56">{c.property.title}</Link></td>
                  <td className="td hidden sm:table-cell">{eur(c.salePrice)}</td>
                  <td className="td hidden md:table-cell">{eur(c.fees)}</td>
                  <td className="td font-semibold text-gold-dark">{eur(c.advisorAmount)} <span className="text-xs font-normal text-gray-400">({c.advisorPct}%)</span></td>
                  <td className="td hidden lg:table-cell text-gray-500">{eur(c.agencyAmount)}</td>
                  <td className="td"><Badge tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Badge></td>
                </tr>
              ))}
              {commissions.length === 0 && <tr><td colSpan={6} className="td text-center text-gray-400 py-10">Aucune commission enregistrée.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
