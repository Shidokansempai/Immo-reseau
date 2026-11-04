import Link from "next/link";
import { requireAuth } from "@/lib/tenant";
import { db } from "@/lib/db";
import { PageHeader, Card, Badge } from "@/components/ui";
import { eur, dateFR, PROPERTY_TYPE } from "@/lib/format";
import ValuationForm from "./ValuationForm";

export const dynamic = "force-dynamic";

export default async function AvisPage() {
  const s = await requireAuth();
  const valuations = await db.valuation.findMany({
    where: { organizationId: s.organizationId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <div>
      <PageHeader title="Avis de valeur" subtitle="Estimez un bien et générez un rapport professionnel." />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <h2 className="font-bold mb-4">Nouvelle estimation</h2>
            <ValuationForm />
          </Card>
        </div>

        <div>
          <h2 className="section-title mb-2">Historique</h2>
          <div className="space-y-2">
            {valuations.length === 0 && <p className="text-sm text-gray-400">Aucune estimation.</p>}
            {valuations.map((v) => (
              <Link key={v.id} href={`/avis-de-valeur/${v.id}`} className="card p-3 block hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium truncate">{v.address || v.city || "Estimation"}</span>
                  <Badge tone={v.status === "FINALIZED" ? "green" : "gray"}>{v.status === "FINALIZED" ? "Finalisé" : "Brouillon"}</Badge>
                </div>
                <div className="mt-1 text-xs text-gray-400">{PROPERTY_TYPE[v.propertyType]} · {v.livingArea ?? "—"} m² · {dateFR(v.createdAt)}</div>
                <div className="mt-1 font-bold text-gold-dark">{eur(v.priceMid)}</div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
