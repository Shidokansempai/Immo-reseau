import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { requireAuth } from "@/lib/tenant";
import { db } from "@/lib/db";
import { PageHeader, Badge, StatCard } from "@/components/ui";
import { eur, dateFR, daysUntil, MANDATE_TYPE, MANDATE_STATUS } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function MandatsPage() {
  const s = await requireAuth();
  const mandates = await db.mandate.findMany({
    where: { organizationId: s.organizationId },
    orderBy: [{ status: "asc" }, { expiresAt: "asc" }],
    include: { property: true, seller: true },
  });

  const active = mandates.filter((m) => m.status === "ACTIVE");
  const exclusive = active.filter((m) => m.type === "EXCLUSIVE").length;
  const expiringSoon = active.filter((m) => { const d = daysUntil(m.expiresAt); return d !== null && d >= 0 && d <= 30; }).length;

  return (
    <div>
      <PageHeader title="Mandats" subtitle="Suivi des mandats et alertes d'échéance." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Mandats actifs" value={active.length} accent="azure" />
        <StatCard label="Exclusifs" value={exclusive} accent="gold" />
        <StatCard label="À échéance < 30j" value={expiringSoon} accent="red" />
        <StatCard label="Total" value={mandates.length} />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="th">N° / Bien</th>
                <th className="th hidden md:table-cell">Type</th>
                <th className="th hidden lg:table-cell">Vendeur</th>
                <th className="th hidden sm:table-cell">Prix</th>
                <th className="th">Échéance</th>
                <th className="th">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--border)]">
              {mandates.map((m) => {
                const d = daysUntil(m.expiresAt);
                const warn = m.status === "ACTIVE" && d !== null && d >= 0 && d <= 30;
                return (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="td">
                      <Link href={`/mandats/${m.id}`}>
                        <div className="font-medium">{m.number}</div>
                        <div className="text-xs text-gray-400 truncate max-w-56">{m.property.title}</div>
                      </Link>
                    </td>
                    <td className="td hidden md:table-cell"><Badge tone={m.type === "EXCLUSIVE" ? "gold" : "gray"}>{MANDATE_TYPE[m.type]}</Badge></td>
                    <td className="td hidden lg:table-cell text-gray-500">{m.seller ? `${m.seller.firstName} ${m.seller.lastName}` : "—"}</td>
                    <td className="td hidden sm:table-cell font-medium">{eur(m.price)}</td>
                    <td className="td">
                      <div className="flex items-center gap-1.5">
                        {warn && <AlertTriangle size={14} className="text-red-500" />}
                        <span className={warn ? "text-red-600 font-medium" : "text-gray-600"}>
                          {dateFR(m.expiresAt)}{m.status === "ACTIVE" && d !== null && d >= 0 ? ` (${d}j)` : ""}
                        </span>
                      </div>
                    </td>
                    <td className="td"><Badge tone={m.status === "ACTIVE" ? "green" : m.status === "SOLD" ? "blue" : m.status === "EXPIRED" ? "red" : "gray"}>{MANDATE_STATUS[m.status]}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
