import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Phone, Mail, MapPin, Calendar, Clock, ArrowLeft, Tag, FileText, Target, Home,
} from "lucide-react";
import { requireAuth } from "@/lib/tenant";
import { db } from "@/lib/db";
import { Card, Badge, Avatar } from "@/components/ui";
import {
  CONTACT_TYPE, CONTACT_STATUS, INTERACTION_TYPE, initials, dateFR, dateTimeFR, relativeFR, parseTags,
} from "@/lib/format";
import LogInteraction from "./LogInteraction";
import MessageTemplates from "./MessageTemplates";

export const dynamic = "force-dynamic";

export default async function ContactDetail({ params }: { params: { id: string } }) {
  const s = await requireAuth();
  const contact = await db.contact.findFirst({
    where: { id: params.id, organizationId: s.organizationId },
    include: {
      interactions: { orderBy: { at: "desc" }, include: { user: true } },
      tasks: { where: { done: false }, orderBy: { dueAt: "asc" } },
      events: { orderBy: { startAt: "desc" }, take: 5, include: { property: true } },
      stage: true,
      buyerProfile: true,
      mandatesAsSeller: { include: { property: true } },
      owner: true,
    },
  });
  if (!contact) notFound();

  const org = await db.organization.findUnique({ where: { id: s.organizationId } });
  const templates = await db.messageTemplate.findMany({ where: { organizationId: s.organizationId } });

  const tags = parseTags(contact.tags);

  return (
    <div>
      <Link href="/contacts" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-ink mb-4"><ArrowLeft size={15} /> Contacts</Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonne gauche : identité */}
        <div className="space-y-6">
          <Card>
            <div className="flex items-center gap-4">
              <Avatar initials={initials(contact.firstName, contact.lastName)} size={56} />
              <div className="min-w-0">
                <h1 className="text-xl font-bold truncate">{contact.firstName} {contact.lastName}</h1>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  <Badge tone="gold">{CONTACT_TYPE[contact.type]}</Badge>
                  <Badge tone={contact.status === "WON" ? "green" : contact.status === "LOST" ? "red" : "gray"}>{CONTACT_STATUS[contact.status]}</Badge>
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-2.5 text-sm">
              {contact.phone && <Row icon={<Phone size={15} />}><a href={`tel:${contact.phone}`} className="hover:text-azure">{contact.phone}</a></Row>}
              {contact.email && <Row icon={<Mail size={15} />}><a href={`mailto:${contact.email}`} className="hover:text-azure truncate">{contact.email}</a></Row>}
              {contact.city && <Row icon={<MapPin size={15} />}>{contact.city}</Row>}
              {contact.birthDate && <Row icon={<Calendar size={15} />}>Né(e) le {dateFR(contact.birthDate)}</Row>}
              <Row icon={<Clock size={15} />}>Dernier contact : {dateFR(contact.lastContactAt)}</Row>
              <Row icon={<Clock size={15} />}>Prochaine relance : <span className="font-medium">{relativeFR(contact.nextFollowUpAt)}</span></Row>
            </div>

            <div className="mt-4 flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2">
              <span className="text-xs text-gray-500">Score prospect</span>
              <span className={`text-lg font-bold ${contact.score >= 70 ? "text-gold-dark" : "text-azure"}`}>{contact.score}/100</span>
            </div>

            {tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {tags.map((t) => <span key={t} className="chip bg-gray-100 text-gray-600"><Tag size={11} /> {t}</span>)}
              </div>
            )}

            <div className="mt-4 text-xs text-gray-400">
              Source : {contact.source || "—"} · Conseiller : {contact.owner?.name ?? "—"}
            </div>
          </Card>

          {contact.notes && (
            <Card>
              <h3 className="section-title mb-2">Notes</h3>
              <p className="text-sm text-gray-600 whitespace-pre-line">{contact.notes}</p>
            </Card>
          )}

          {contact.buyerProfile && (
            <Card>
              <h3 className="font-semibold flex items-center gap-2 mb-3"><Target size={16} className="text-azure" /> Profil acquéreur</h3>
              <ul className="text-sm space-y-1 text-gray-600">
                <li>Budget : {contact.buyerProfile.budgetMin?.toLocaleString("fr-FR")} – {contact.buyerProfile.budgetMax?.toLocaleString("fr-FR")} €</li>
                <li>Secteurs : {contact.buyerProfile.areas || "—"}</li>
                <li>Types : {contact.buyerProfile.propertyTypes || "—"}</li>
                {contact.buyerProfile.financingReady && <li className="text-emerald-600 font-medium">✓ Financement pré-qualifié (2L)</li>}
              </ul>
            </Card>
          )}
        </div>

        {/* Colonne centre/droite : actions + timeline */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex flex-wrap gap-2">
            <LogInteraction contactId={contact.id} />
            <MessageTemplates
              templates={templates.map((t) => ({ id: t.id, name: t.name, channel: t.channel, body: t.body }))}
              contact={{ firstName: contact.firstName, city: contact.city }}
              advisorName={s.name}
            />
          </div>

          {/* Mandats/biens liés */}
          {contact.mandatesAsSeller.length > 0 && (
            <Card>
              <h3 className="font-semibold flex items-center gap-2 mb-3"><Home size={16} /> Biens & mandats</h3>
              <div className="space-y-2">
                {contact.mandatesAsSeller.map((m) => (
                  <Link key={m.id} href={`/mandats/${m.id}`} className="flex items-center justify-between rounded-xl border border-[color:var(--border)] px-3 py-2 hover:bg-gray-50">
                    <span className="text-sm font-medium truncate">{m.property.title}</span>
                    <Badge tone="blue">{m.number}</Badge>
                  </Link>
                ))}
              </div>
            </Card>
          )}

          {/* Tâches ouvertes */}
          {contact.tasks.length > 0 && (
            <Card>
              <h3 className="font-semibold flex items-center gap-2 mb-3"><FileText size={16} /> Tâches à venir</h3>
              <div className="space-y-2">
                {contact.tasks.map((t) => (
                  <div key={t.id} className="flex items-center gap-2 text-sm">
                    <span className={`h-2 w-2 rounded-full ${t.priority === "HIGH" ? "bg-red-500" : "bg-gold"}`} />
                    <span className="flex-1">{t.title}</span>
                    <span className="text-xs text-gray-400">{relativeFR(t.dueAt)}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Timeline */}
          <Card>
            <h3 className="font-semibold mb-4">Historique des interactions</h3>
            {contact.interactions.length === 0 ? (
              <p className="text-sm text-gray-400">Aucune interaction consignée. Commencez par « Consigner ».</p>
            ) : (
              <ol className="relative border-l-2 border-gray-100 ml-2 space-y-5">
                {contact.interactions.map((i) => (
                  <li key={i.id} className="ml-5">
                    <span className="absolute -left-[9px] mt-1 h-4 w-4 rounded-full bg-white border-2 border-azure" />
                    <div className="flex items-center gap-2">
                      <Badge tone="blue">{INTERACTION_TYPE[i.type] ?? i.type}</Badge>
                      <span className="text-xs text-gray-400">{dateTimeFR(i.at)}</span>
                    </div>
                    {i.subject && <p className="mt-1 text-sm font-medium">{i.subject}</p>}
                    {i.outcome && <p className="text-xs text-gray-500">→ {i.outcome}</p>}
                    {i.user && <p className="text-xs text-gray-400 mt-0.5">par {i.user.name}</p>}
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 text-gray-600">
      <span className="text-gray-400">{icon}</span>
      <span className="truncate">{children}</span>
    </div>
  );
}
