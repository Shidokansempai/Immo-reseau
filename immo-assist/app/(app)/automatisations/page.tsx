import { Workflow, Clock, ArrowRight } from "lucide-react";
import { requireAuth } from "@/lib/tenant";
import { db } from "@/lib/db";
import { PageHeader, Card, Badge } from "@/components/ui";
import Toggle from "./Toggle";

export const dynamic = "force-dynamic";

const TRIGGER_LABEL: Record<string, string> = {
  NEW_PROSPECT: "Nouveau prospect",
  NO_REPLY_7D: "Sans réponse depuis 7 jours",
  MANDATE_SIGNED: "Mandat signé",
  VISIT_DONE: "Visite terminée",
  BIRTHDAY: "Anniversaire client",
  MANDATE_EXPIRING_30D: "Mandat expire dans 30 jours",
  NEW_PROPERTY_MATCH: "Nouveau bien correspondant à un acquéreur",
  AFTER_ESTIMATION: "Après une estimation",
  AFTER_OFFER: "Après une offre",
};
const ACTION_LABEL: Record<string, string> = {
  CREATE_TASK: "Créer une tâche",
  CREATE_FOLLOWUP: "Créer une relance",
  PROPOSE_MESSAGE: "Proposer un message",
  CREATE_ALERT: "Créer une alerte",
  NOTIFY: "Envoyer une notification",
};
const COND_LABEL: Record<string, string> = {
  NO_CONTACT: "Aucun contact depuis X jours",
  AFTER_ESTIMATION: "Après une estimation",
  AFTER_VISIT: "Après une visite",
  AFTER_OFFER: "Après une offre",
  MANDATE_EXPIRING: "Mandat proche de l'échéance",
};

export default async function AutomatisationsPage() {
  const s = await requireAuth();
  const [automations, reminders] = await Promise.all([
    db.automationRule.findMany({ where: { organizationId: s.organizationId }, orderBy: { createdAt: "asc" } }),
    db.reminderRule.findMany({ where: { organizationId: s.organizationId }, orderBy: { delayDays: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader title="Automatisations" subtitle="Le logiciel travaille pour vous : SI un événement se produit, ALORS une action se déclenche." />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SI → ALORS */}
        <div>
          <h2 className="section-title mb-3 flex items-center gap-2"><Workflow size={16} /> Règles SI → ALORS</h2>
          <div className="space-y-3">
            {automations.map((a) => (
              <Card key={a.id} className="py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold">{a.name}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <Badge tone="blue">SI · {TRIGGER_LABEL[a.trigger] ?? a.trigger}</Badge>
                      <ArrowRight size={13} className="text-gray-300" />
                      <Badge tone="gold">ALORS · {ACTION_LABEL[a.action] ?? a.action}</Badge>
                    </div>
                  </div>
                  <Toggle id={a.id} enabled={a.enabled} kind="automation" />
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Relances */}
        <div>
          <h2 className="section-title mb-3 flex items-center gap-2"><Clock size={16} /> Moteur de relance</h2>
          <div className="space-y-3">
            {reminders.map((r) => (
              <Card key={r.id} className="py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold">{r.name}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <Badge tone="gray">{COND_LABEL[r.condition] ?? r.condition}</Badge>
                      {r.condition === "NO_CONTACT" && <Badge tone="blue">{r.delayDays} jours</Badge>}
                      <Badge tone={r.priority === "HIGH" ? "red" : "gray"}>{r.priority === "HIGH" ? "Prioritaire" : "Normale"}</Badge>
                      <Badge tone="gold">{r.action === "TASK" ? "Créer une tâche" : "Proposer un message"}</Badge>
                    </div>
                  </div>
                  <Toggle id={r.id} enabled={r.enabled} kind="reminder" />
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-6 text-xs text-gray-400">
        Ces règles s'exécutent automatiquement (chargement du tableau de bord et des tâches). En production,
        elles seraient également déclenchées par un planificateur côté serveur (cron / file d'attente).
      </p>
    </div>
  );
}
