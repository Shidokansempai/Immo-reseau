import Link from "next/link";
import {
  Flame, UserPlus, FileSignature, Building2, CalendarClock, Calculator,
  Bell, AlertTriangle, TrendingUp, Phone, ArrowRight, CheckCircle2,
} from "lucide-react";
import { requireAuth } from "@/lib/tenant";
import { db } from "@/lib/db";
import { runReminderEngine } from "@/lib/reminders";
import { eur, dateFR, relativeFR, initials } from "@/lib/format";
import { PageHeader, StatCard, Card, Badge, Avatar } from "@/components/ui";
import RevenueChart from "./RevenueChart";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await requireAuth();
  const orgId = session.organizationId;

  // Le moteur de relance matérialise les tâches/alertes dues (idempotent).
  await runReminderEngine(orgId);

  const now = new Date();
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const soon30 = new Date(now.getTime() + 30 * 864e5);

  const [
    prospects, hotProspects, newProspects, activeMandates, exclusiveMandates,
    expiringMandates, properties, visitsToday, estimationsToday, followUpsDue,
    overdueTasks, underOffer, sold, commissions, wonStage, lostCount, totalProspects,
    todayTasks, todayEvents, followUpContacts, notifications, recentContacts,
  ] = await Promise.all([
    db.contact.count({ where: { organizationId: orgId, type: { in: ["PROSPECT_SELLER", "PROSPECT_BUYER"] } } }),
    db.contact.count({ where: { organizationId: orgId, type: { in: ["PROSPECT_SELLER", "PROSPECT_BUYER"] }, score: { gte: 70 } } }),
    db.contact.count({ where: { organizationId: orgId, type: { in: ["PROSPECT_SELLER", "PROSPECT_BUYER"] }, createdAt: { gte: monthStart } } }),
    db.mandate.count({ where: { organizationId: orgId, status: "ACTIVE" } }),
    db.mandate.count({ where: { organizationId: orgId, status: "ACTIVE", type: "EXCLUSIVE" } }),
    db.mandate.count({ where: { organizationId: orgId, status: "ACTIVE", expiresAt: { lte: soon30, gte: now } } }),
    db.property.count({ where: { organizationId: orgId, status: { in: ["MANDATE_ACTIVE", "UNDER_OFFER", "ESTIMATION"] } } }),
    db.event.count({ where: { organizationId: orgId, kind: "VISIT", startAt: { gte: todayStart, lte: todayEnd } } }),
    db.event.count({ where: { organizationId: orgId, kind: "ESTIMATION", startAt: { gte: todayStart, lte: todayEnd } } }),
    db.contact.count({ where: { organizationId: orgId, nextFollowUpAt: { lte: todayEnd } } }),
    db.task.count({ where: { organizationId: orgId, done: false, dueAt: { lt: todayStart } } }),
    db.property.count({ where: { organizationId: orgId, status: "UNDER_OFFER" } }),
    db.property.count({ where: { organizationId: orgId, status: "SOLD" } }),
    db.commission.findMany({ where: { organizationId: orgId } }),
    db.contact.count({ where: { organizationId: orgId, status: "WON" } }),
    db.contact.count({ where: { organizationId: orgId, status: "LOST" } }),
    db.contact.count({ where: { organizationId: orgId, type: { in: ["PROSPECT_SELLER", "PROSPECT_BUYER"] } } }),
    db.task.findMany({ where: { organizationId: orgId, done: false, dueAt: { lte: todayEnd } }, include: { contact: true }, orderBy: [{ priority: "desc" }, { dueAt: "asc" }], take: 8 }),
    db.event.findMany({ where: { organizationId: orgId, startAt: { gte: todayStart } }, include: { contact: true, property: true }, orderBy: { startAt: "asc" }, take: 6 }),
    db.contact.findMany({ where: { organizationId: orgId, nextFollowUpAt: { lte: todayEnd } }, orderBy: { nextFollowUpAt: "asc" }, take: 6 }),
    db.notification.findMany({ where: { organizationId: orgId, read: false }, orderBy: { createdAt: "desc" }, take: 5 }),
    db.contact.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);

  const caForecast = commissions.filter((c) => c.status !== "PAID").reduce((s, c) => s + (c.salePrice ?? 0), 0);
  const caRealized = commissions.filter((c) => c.status === "PAID").reduce((s, c) => s + (c.salePrice ?? 0), 0);
  const commForecast = commissions.filter((c) => c.status !== "PAID").reduce((s, c) => s + (c.advisorAmount ?? 0), 0);
  const commRealized = commissions.filter((c) => c.status === "PAID").reduce((s, c) => s + (c.advisorAmount ?? 0), 0);
  const conversion = totalProspects > 0 ? Math.round((wonStage / (wonStage + lostCount || 1)) * 100) : 0;

  // Sources de prospects les plus performantes
  const sourceRows = await db.contact.groupBy({
    by: ["source"],
    where: { organizationId: orgId, source: { not: null } },
    _count: { _all: true },
    orderBy: { _count: { source: "desc" } },
    take: 5,
  });

  const todoCount = todayTasks.length + followUpContacts.length;

  return (
    <div>
      <PageHeader
        title={`Bonjour ${session.name.split(" ")[0]} 👋`}
        subtitle="Voici l'essentiel de votre activité aujourd'hui."
      />

      {/* KPI principaux */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatCard label="Prospects" value={prospects} hint={`${newProspects} ce mois`} />
        <StatCard label="Prospects chauds" value={hotProspects} accent="gold" hint="score ≥ 70" />
        <StatCard label="Mandats actifs" value={activeMandates} accent="azure" hint={`${exclusiveMandates} exclusifs`} />
        <StatCard label="Biens au portefeuille" value={properties} hint={`${underOffer} sous offre`} />
        <StatCard label="Taux de conversion" value={`${conversion}%`} accent="green" />
        <StatCard label="Ventes réalisées" value={sold} accent="green" />
      </div>

      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="CA réalisé" value={eur(caRealized, { compact: true })} accent="green" />
        <StatCard label="CA prévisionnel" value={eur(caForecast, { compact: true })} accent="gold" />
        <StatCard label="Commissions réalisées" value={eur(commRealized, { compact: true })} accent="green" />
        <StatCard label="Commissions prévues" value={eur(commForecast, { compact: true })} accent="gold" />
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* À faire aujourd'hui */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg flex items-center gap-2">
                <Flame size={18} className="text-gold" /> À faire aujourd'hui
              </h2>
              <Badge tone="gold">{todoCount} actions</Badge>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-5 text-center">
              <MiniStat icon={<Phone size={15} />} n={followUpsDue} label="à relancer" />
              <MiniStat icon={<CalendarClock size={15} />} n={visitsToday} label="visites" />
              <MiniStat icon={<Calculator size={15} />} n={estimationsToday} label="estimations" />
              <MiniStat icon={<AlertTriangle size={15} />} n={overdueTasks} label="en retard" tone="red" />
            </div>

            <div className="space-y-2">
              {todayTasks.map((t) => (
                <Link key={t.id} href="/taches" className="flex items-center gap-3 rounded-xl border border-[color:var(--border)] px-3 py-2.5 hover:bg-gray-50">
                  <span className={`h-2 w-2 rounded-full ${t.priority === "HIGH" ? "bg-red-500" : t.priority === "LOW" ? "bg-gray-300" : "bg-gold"}`} />
                  <span className="flex-1 text-sm font-medium truncate">{t.title}</span>
                  {t.contact && <span className="text-xs text-gray-400 truncate hidden sm:block">{t.contact.firstName} {t.contact.lastName}</span>}
                  <span className="text-xs text-gray-400">{relativeFR(t.dueAt)}</span>
                </Link>
              ))}
              {followUpContacts.map((c) => (
                <Link key={c.id} href={`/contacts/${c.id}`} className="flex items-center gap-3 rounded-xl border border-dashed border-[color:var(--border)] px-3 py-2.5 hover:bg-gray-50">
                  <Avatar initials={initials(c.firstName, c.lastName)} size={26} />
                  <span className="flex-1 text-sm font-medium truncate">Relancer {c.firstName} {c.lastName}</span>
                  <span className="text-xs text-gray-400">{relativeFR(c.nextFollowUpAt)}</span>
                </Link>
              ))}
              {todoCount === 0 && (
                <div className="flex items-center gap-2 text-sm text-emerald-600 py-4 justify-center">
                  <CheckCircle2 size={18} /> Tout est à jour. Allez chercher du mandat.
                </div>
              )}
            </div>
          </Card>

          {/* Revenu */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg flex items-center gap-2"><TrendingUp size={18} className="text-azure" /> Chiffre d'affaires & commissions</h2>
            </div>
            <RevenueChart
              data={[
                { name: "CA réalisé", ca: caRealized, comm: commRealized },
                { name: "CA prévisionnel", ca: caForecast, comm: commForecast },
              ]}
            />
          </Card>
        </div>

        {/* Colonne droite */}
        <div className="space-y-6">
          {/* Agenda du jour */}
          <Card>
            <h2 className="font-bold text-lg flex items-center gap-2 mb-3"><CalendarClock size={18} className="text-azure" /> Agenda</h2>
            <div className="space-y-2">
              {todayEvents.length === 0 && <p className="text-sm text-gray-400">Aucun événement prévu.</p>}
              {todayEvents.map((e) => (
                <div key={e.id} className="flex gap-3 rounded-xl bg-gray-50 px-3 py-2">
                  <div className="text-xs font-bold text-azure w-12 shrink-0">{new Date(e.startAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{e.title}</div>
                    <div className="text-xs text-gray-400 truncate">{dateFR(e.startAt)}{e.location ? ` · ${e.location}` : ""}</div>
                  </div>
                </div>
              ))}
            </div>
            <Link href="/planning" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-azure">Voir le planning <ArrowRight size={14} /></Link>
          </Card>

          {/* Notifications */}
          <Card>
            <h2 className="font-bold text-lg flex items-center gap-2 mb-3"><Bell size={18} className="text-gold" /> Alertes</h2>
            <div className="space-y-2">
              {notifications.length === 0 && <p className="text-sm text-gray-400">Aucune alerte.</p>}
              {notifications.map((n) => (
                <div key={n.id} className="rounded-xl border border-[color:var(--border)] px-3 py-2">
                  <div className="text-sm font-medium">{n.title}</div>
                  {n.body && <div className="text-xs text-gray-500">{n.body}</div>}
                </div>
              ))}
            </div>
          </Card>

          {/* Sources performantes */}
          <Card>
            <h2 className="font-bold text-lg mb-3">Sources de prospects</h2>
            <div className="space-y-2">
              {sourceRows.map((s) => (
                <div key={s.source} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{s.source}</span>
                  <Badge tone="blue">{s._count._all}</Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ icon, n, label, tone = "ink" }: { icon: React.ReactNode; n: number; label: string; tone?: "ink" | "red" }) {
  return (
    <div className="rounded-xl bg-gray-50 py-2.5">
      <div className={`flex items-center justify-center gap-1 text-lg font-bold ${tone === "red" && n > 0 ? "text-red-600" : "text-ink"}`}>
        {icon} {n}
      </div>
      <div className="text-[11px] text-gray-500">{label}</div>
    </div>
  );
}
