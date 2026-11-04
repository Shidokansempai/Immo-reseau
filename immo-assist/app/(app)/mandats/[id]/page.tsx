import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, AlertTriangle, FileText } from "lucide-react";
import { requireAuth } from "@/lib/tenant";
import { db } from "@/lib/db";
import { Card, Badge } from "@/components/ui";
import { eur, dateFR, daysUntil, MANDATE_TYPE, MANDATE_STATUS } from "@/lib/format";
import RenewButton from "./RenewButton";

export const dynamic = "force-dynamic";

export default async function MandatDetail({ params }: { params: { id: string } }) {
  const s = await requireAuth();
  const m = await db.mandate.findFirst({
    where: { id: params.id, organizationId: s.organizationId },
    include: { property: true, seller: true, documents: true, owner: true },
  });
  if (!m) notFound();

  const d = daysUntil(m.expiresAt);
  const warn = m.status === "ACTIVE" && d !== null && d <= 30;

  return (
    <div>
      <Link href="/mandats" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-ink mb-4"><ArrowLeft size={15} /> Mandats</Link>

      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{m.number}</h1>
            <Badge tone={m.type === "EXCLUSIVE" ? "gold" : "gray"}>{MANDATE_TYPE[m.type]}</Badge>
            <Badge tone={m.status === "ACTIVE" ? "green" : m.status === "SOLD" ? "blue" : "red"}>{MANDATE_STATUS[m.status]}</Badge>
          </div>
          <Link href={`/biens/${m.propertyId}`} className="text-sm text-gray-500 hover:text-azure">{m.property.title}</Link>
        </div>
        {m.status === "ACTIVE" && <RenewButton id={m.id} />}
      </div>

      {warn && (
        <div className="mb-6 flex items-center gap-2 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
          <AlertTriangle size={18} />
          Ce mandat expire {d !== null && d >= 0 ? `dans ${d} jour(s)` : "est expiré"} ({dateFR(m.expiresAt)}). Proposez un renouvellement en exclusivité dès maintenant.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <h3 className="section-title mb-3">Informations</h3>
          <ul className="text-sm space-y-2 text-gray-600">
            <li className="flex justify-between"><span>Prix</span><span className="font-bold text-ink">{eur(m.price)}</span></li>
            <li className="flex justify-between"><span>Honoraires ({m.feesPct}%)</span><span className="font-medium text-gold-dark">{eur(m.fees)}</span></li>
            <li className="flex justify-between"><span>Signé le</span><span>{dateFR(m.signedAt)}</span></li>
            <li className="flex justify-between"><span>Expire le</span><span>{dateFR(m.expiresAt)}</span></li>
            <li className="flex justify-between"><span>Conseiller</span><span>{m.owner?.name ?? "—"}</span></li>
          </ul>
        </Card>

        <Card>
          <h3 className="section-title mb-3">Vendeur</h3>
          {m.seller ? (
            <Link href={`/contacts/${m.seller.id}`} className="block">
              <div className="font-semibold">{m.seller.firstName} {m.seller.lastName}</div>
              <div className="text-sm text-gray-500">{m.seller.phone}</div>
              <div className="text-sm text-gray-500">{m.seller.email}</div>
            </Link>
          ) : <p className="text-sm text-gray-400">Non renseigné.</p>}
        </Card>

        <Card>
          <h3 className="section-title mb-3">Documents</h3>
          <div className="space-y-2">
            {m.documents.length === 0 && <p className="text-sm text-gray-400">Aucun document.</p>}
            {m.documents.map((doc) => (
              <div key={doc.id} className="flex items-center gap-2 text-sm">
                <FileText size={15} className="text-gray-400" />
                <span className="flex-1 truncate">{doc.name}</span>
                {doc.signed && <Badge tone="green">Signé</Badge>}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
