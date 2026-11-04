import Link from "next/link";
import { BedDouble, Maximize, MapPin } from "lucide-react";
import { requireAuth } from "@/lib/tenant";
import { db } from "@/lib/db";
import { PageHeader, Badge } from "@/components/ui";
import { eur, PROPERTY_TYPE, PROPERTY_STATUS } from "@/lib/format";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, any> = {
  MANDATE_ACTIVE: "green", UNDER_OFFER: "amber", COMPROMISE: "purple", SOLD: "gray",
  ESTIMATION: "blue", MANDATE_TO_SIGN: "gold", ARCHIVED: "gray", PROSPECT: "gray",
};

export default async function BiensPage() {
  const s = await requireAuth();
  const properties = await db.property.findMany({
    where: { organizationId: s.organizationId },
    orderBy: { createdAt: "desc" },
    include: { mandate: true },
  });

  return (
    <div>
      <PageHeader title="Biens" subtitle={`${properties.length} biens au portefeuille.`} />
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
        {properties.map((p) => (
          <Link key={p.id} href={`/biens/${p.id}`} className="card overflow-hidden hover:shadow-pop transition group">
            <div className="relative h-44 bg-gray-100">
              {p.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.photoUrl} alt={p.title} className="h-full w-full object-cover group-hover:scale-105 transition" />
              ) : (
                <div className="h-full w-full grid place-items-center text-gray-300">Pas de photo</div>
              )}
              <div className="absolute top-3 left-3"><Badge tone={STATUS_TONE[p.status] ?? "gray"}>{PROPERTY_STATUS[p.status]}</Badge></div>
              {p.mandate?.type === "EXCLUSIVE" && <div className="absolute top-3 right-3"><Badge tone="gold">Exclusif</Badge></div>}
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">{p.reference}</span>
                <span className="text-xs text-gray-400">{PROPERTY_TYPE[p.propertyType]}</span>
              </div>
              <h3 className="mt-1 font-semibold truncate">{p.title}</h3>
              <div className="mt-1 flex items-center gap-1 text-xs text-gray-500"><MapPin size={13} /> {p.city}</div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-lg font-bold text-ink">{eur(p.price)}</span>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  {p.livingArea ? <span className="flex items-center gap-1"><Maximize size={13} /> {p.livingArea} m²</span> : null}
                  {p.bedrooms ? <span className="flex items-center gap-1"><BedDouble size={13} /> {p.bedrooms}</span> : null}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
