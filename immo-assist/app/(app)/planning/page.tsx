import Link from "next/link";
import { MapPin, Clock } from "lucide-react";
import { requireAuth } from "@/lib/tenant";
import { db } from "@/lib/db";
import { PageHeader, Card, Badge } from "@/components/ui";
import { EVENT_KIND, timeFR } from "@/lib/format";

export const dynamic = "force-dynamic";

const KIND_TONE: Record<string, any> = {
  VISIT: "blue", ESTIMATION: "amber", SIGNATURE: "green", SELLER_MEETING: "gold",
  BUYER_MEETING: "purple", CALL: "gray", COMPROMISE: "green", FOLLOWUP: "gray",
};

export default async function PlanningPage() {
  const s = await requireAuth();
  const start = new Date(); start.setHours(0, 0, 0, 0);

  const events = await db.event.findMany({
    where: { organizationId: s.organizationId, startAt: { gte: start } },
    orderBy: { startAt: "asc" },
    include: { contact: true, property: true },
    take: 60,
  });

  // Regroupement par jour
  const groups = new Map<string, typeof events>();
  for (const e of events) {
    const key = new Date(e.startAt).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  }

  return (
    <div>
      <PageHeader title="Planning" subtitle="Vos rendez-vous, visites, estimations et signatures à venir." />

      <div className="flex flex-wrap gap-2 mb-6">
        {Object.entries(EVENT_KIND).slice(0, 6).map(([k, v]) => (
          <Badge key={k} tone={KIND_TONE[k] ?? "gray"}>{v}</Badge>
        ))}
      </div>

      {groups.size === 0 && <p className="text-sm text-gray-400">Aucun événement à venir.</p>}

      <div className="space-y-6">
        {Array.from(groups.entries()).map(([day, evs]) => (
          <div key={day}>
            <h2 className="section-title mb-2 capitalize">{day}</h2>
            <div className="space-y-2">
              {evs.map((e) => (
                <Card key={e.id} className="py-3">
                  <div className="flex items-start gap-4">
                    <div className="flex items-center gap-1 text-sm font-bold text-azure w-16 shrink-0"><Clock size={13} /> {timeFR(e.startAt)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge tone={KIND_TONE[e.kind] ?? "gray"}>{EVENT_KIND[e.kind]}</Badge>
                        <span className="font-medium truncate">{e.title}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-400">
                        {e.location && <span className="flex items-center gap-1"><MapPin size={12} /> {e.location}</span>}
                        {e.contact && <Link href={`/contacts/${e.contact.id}`} className="hover:text-azure">{e.contact.firstName} {e.contact.lastName}</Link>}
                        {e.property && <Link href={`/biens/${e.property.id}`} className="hover:text-azure truncate">{e.property.title}</Link>}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-8 text-xs text-gray-400">
        Synchronisation Google Calendar / Outlook : architecture prête (Paramètres → Intégrations).
      </p>
    </div>
  );
}
