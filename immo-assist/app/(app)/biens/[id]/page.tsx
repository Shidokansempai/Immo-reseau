import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Target, Home, Zap, Car, Waves, Trees, Building } from "lucide-react";
import { requireAuth } from "@/lib/tenant";
import { db } from "@/lib/db";
import { Card, Badge, Avatar, ProgressBar } from "@/components/ui";
import { eur, num, PROPERTY_TYPE, PROPERTY_STATUS, MANDATE_TYPE, dateFR, initials } from "@/lib/format";
import { matchBuyersToProperty } from "@/lib/matching";

export const dynamic = "force-dynamic";

export default async function BienDetail({ params }: { params: { id: string } }) {
  const s = await requireAuth();
  const p = await db.property.findFirst({
    where: { id: params.id, organizationId: s.organizationId },
    include: { mandate: { include: { seller: true } }, ownerContact: true, owner: true, commission: true },
  });
  if (!p) notFound();

  const buyers = await db.buyerProfile.findMany({
    where: { organizationId: s.organizationId },
    include: { contact: true },
  });
  const matches = matchBuyersToProperty(p, buyers);

  const specs: [string, any, React.ReactNode?][] = [
    ["Surface habitable", p.livingArea ? `${num(p.livingArea)} m²` : "—"],
    ["Terrain", p.landArea ? `${num(p.landArea)} m²` : "—"],
    ["Pièces", p.rooms ?? "—"],
    ["Chambres", p.bedrooms ?? "—"],
    ["Salles de bain", p.bathrooms ?? "—"],
    ["Étage", p.floor ?? "—"],
    ["Année", p.yearBuilt ?? "—"],
    ["État", p.condition ?? "—"],
    ["DPE", p.dpe ?? "—"],
    ["GES", p.ges ?? "—"],
  ];

  const amenities = [
    p.hasParking && { icon: <Car size={14} />, label: "Parking" },
    p.hasGarage && { icon: <Building size={14} />, label: "Garage" },
    p.hasPool && { icon: <Waves size={14} />, label: "Piscine" },
    p.landArea && { icon: <Trees size={14} />, label: "Terrain" },
    p.hasElevator && { icon: <Zap size={14} />, label: "Ascenseur" },
  ].filter(Boolean) as { icon: React.ReactNode; label: string }[];

  return (
    <div>
      <Link href="/biens" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-ink mb-4"><ArrowLeft size={15} /> Biens</Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-0 overflow-hidden">
            <div className="relative h-64 bg-gray-100">
              {p.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.photoUrl} alt={p.title} className="h-full w-full object-cover" />
              ) : <div className="h-full grid place-items-center text-gray-300">Pas de photo</div>}
              <div className="absolute top-3 left-3 flex gap-2">
                <Badge tone="green">{PROPERTY_STATUS[p.status]}</Badge>
                {p.mandate?.type === "EXCLUSIVE" && <Badge tone="gold">Exclusif</Badge>}
              </div>
            </div>
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs text-gray-400">{p.reference} · {PROPERTY_TYPE[p.propertyType]}</div>
                  <h1 className="text-xl font-bold mt-0.5">{p.title}</h1>
                  <p className="text-sm text-gray-500">{p.address ? `${p.address}, ` : ""}{p.city}</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">{eur(p.price)}</div>
                  {p.livingArea ? <div className="text-xs text-gray-400">{eur(Math.round((p.price ?? 0) / p.livingArea))}/m²</div> : null}
                </div>
              </div>

              {amenities.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {amenities.map((a, i) => <span key={i} className="chip bg-gray-100 text-gray-600">{a.icon} {a.label}</span>)}
                </div>
              )}

              {p.description && <p className="mt-4 text-sm text-gray-600">{p.description}</p>}

              <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-4">
                {specs.map(([label, value]) => (
                  <div key={label}>
                    <div className="text-xs text-gray-400">{label}</div>
                    <div className="text-sm font-medium">{value}</div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Matching + mandat + honoraires */}
        <div className="space-y-6">
          <Card>
            <div className="flex items-center gap-2 mb-1">
              <Target size={18} className="text-azure" />
              <h3 className="font-bold">Acquéreurs correspondants</h3>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              <span className="font-bold text-azure">{matches.length}</span> acquéreur(s) correspondent à ce bien.
            </p>
            <div className="space-y-3">
              {matches.slice(0, 6).map((m) => (
                <Link key={m.contact.id} href={`/contacts/${m.contact.id}`} className="block rounded-xl border border-[color:var(--border)] p-3 hover:bg-gray-50">
                  <div className="flex items-center gap-2">
                    <Avatar initials={initials(m.contact.firstName, m.contact.lastName)} size={28} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{m.contact.firstName} {m.contact.lastName}</div>
                    </div>
                    <span className="text-sm font-bold text-azure">{m.score}%</span>
                  </div>
                  <div className="mt-2"><ProgressBar value={m.score} tone={m.score >= 75 ? "green" : "azure"} /></div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {m.reasons.slice(0, 3).map((r, i) => <span key={i} className="chip bg-gray-100 text-gray-500 text-[10px]">{r}</span>)}
                  </div>
                </Link>
              ))}
              {matches.length === 0 && <p className="text-sm text-gray-400">Aucun acquéreur ne correspond pour l'instant.</p>}
            </div>
          </Card>

          {p.mandate && (
            <Card>
              <h3 className="font-bold flex items-center gap-2 mb-3"><Home size={16} /> Mandat</h3>
              <ul className="text-sm space-y-1.5 text-gray-600">
                <li className="flex justify-between"><span>Numéro</span><Link href={`/mandats/${p.mandate.id}`} className="font-medium text-azure">{p.mandate.number}</Link></li>
                <li className="flex justify-between"><span>Type</span><span className="font-medium">{MANDATE_TYPE[p.mandate.type]}</span></li>
                <li className="flex justify-between"><span>Signé le</span><span>{dateFR(p.mandate.signedAt)}</span></li>
                <li className="flex justify-between"><span>Expire le</span><span>{dateFR(p.mandate.expiresAt)}</span></li>
                {p.mandate.seller && <li className="flex justify-between"><span>Vendeur</span><span className="font-medium">{p.mandate.seller.firstName} {p.mandate.seller.lastName}</span></li>}
              </ul>
            </Card>
          )}

          <Card>
            <h3 className="font-bold mb-3">Honoraires</h3>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Honoraires ({p.feesPct ?? "—"}%)</span>
              <span className="font-bold text-gold-dark">{eur(p.fees)}</span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
