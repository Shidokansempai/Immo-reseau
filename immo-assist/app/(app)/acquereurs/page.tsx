import Link from "next/link";
import { Target, CheckCircle2 } from "lucide-react";
import { requireAuth } from "@/lib/tenant";
import { db } from "@/lib/db";
import { PageHeader, Card, Badge, Avatar } from "@/components/ui";
import { eur, initials, parseTags, PROPERTY_TYPE } from "@/lib/format";
import { matchBuyersToProperty } from "@/lib/matching";

export const dynamic = "force-dynamic";

export default async function AcquereursPage() {
  const s = await requireAuth();

  const [buyers, activeProps] = await Promise.all([
    db.buyerProfile.findMany({ where: { organizationId: s.organizationId }, include: { contact: true } }),
    db.property.findMany({ where: { organizationId: s.organizationId, status: { in: ["MANDATE_ACTIVE", "UNDER_OFFER", "ESTIMATION"] } } }),
  ]);

  // Pour chaque bien, qui matche — puis on inverse pour compter par acquéreur.
  const matchCountByBuyer = new Map<string, number>();
  for (const p of activeProps) {
    const matches = matchBuyersToProperty(p, buyers);
    for (const mt of matches) {
      matchCountByBuyer.set(mt.contact.id, (matchCountByBuyer.get(mt.contact.id) ?? 0) + 1);
    }
  }

  return (
    <div>
      <PageHeader title="Acquéreurs" subtitle="Profils de recherche et matching automatique avec votre portefeuille." />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {buyers.map((b) => {
          const matched = matchCountByBuyer.get(b.contactId) ?? 0;
          return (
            <Card key={b.id}>
              <div className="flex items-start justify-between">
                <Link href={`/contacts/${b.contactId}`} className="flex items-center gap-3">
                  <Avatar initials={initials(b.contact.firstName, b.contact.lastName)} size={40} />
                  <div>
                    <div className="font-semibold">{b.contact.firstName} {b.contact.lastName}</div>
                    <div className="text-xs text-gray-400">{b.contact.city || "—"}</div>
                  </div>
                </Link>
                {b.financingReady && <Badge tone="green"><CheckCircle2 size={12} /> Financé 2L</Badge>}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
                <Spec label="Budget" value={`${(b.budgetMin ?? 0).toLocaleString("fr-FR")} – ${(b.budgetMax ?? 0).toLocaleString("fr-FR")} €`} />
                <Spec label="Surface min." value={b.minArea ? `${b.minArea} m²` : "—"} />
                <Spec label="Chambres min." value={b.minBedrooms ?? "—"} />
                <Spec label="Types" value={parseTags(b.propertyTypes).map((t) => PROPERTY_TYPE[t] ?? t).join(", ") || "Tous"} />
                <div className="col-span-2">
                  <div className="text-xs text-gray-400">Secteurs</div>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {parseTags(b.areas).map((a) => <span key={a} className="chip bg-gray-100 text-gray-600">{a}</span>)}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between rounded-xl bg-azure/5 px-3 py-2.5">
                <span className="flex items-center gap-2 text-sm text-azure font-medium"><Target size={16} /> Biens correspondants</span>
                <span className="text-lg font-bold text-azure">{matched}</span>
              </div>
            </Card>
          );
        })}
        {buyers.length === 0 && <p className="text-sm text-gray-400">Aucun profil acquéreur.</p>}
      </div>
    </div>
  );
}

function Spec({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <div className="text-xs text-gray-400">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
