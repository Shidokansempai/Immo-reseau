import "server-only";
import { db } from "./db";

/**
 * Moteur de relance (section 6) + matérialisation des automatisations (section 7).
 *
 * Idempotent : exécuté au chargement du dashboard, il crée les tâches/alertes
 * manquantes sans doublon (on vérifie l'existence d'une tâche automatisée
 * équivalente non terminée). En production, ce moteur serait aussi déclenché
 * par un cron/queue — l'architecture est identique.
 */
export async function runReminderEngine(organizationId: string) {
  const rules = await db.reminderRule.findMany({ where: { organizationId, enabled: true } });
  const now = new Date();
  let created = 0;

  for (const rule of rules) {
    if (rule.condition === "NO_CONTACT") {
      const threshold = new Date(now.getTime() - rule.delayDays * 864e5);
      const contacts = await db.contact.findMany({
        where: {
          organizationId,
          status: { notIn: ["LOST", "WON", "INACTIVE"] },
          type: { in: ["PROSPECT_SELLER", "PROSPECT_BUYER", "SELLER", "BUYER"] },
          OR: [{ lastContactAt: { lte: threshold } }, { lastContactAt: null }],
        },
        take: 50,
      });
      for (const c of contacts) {
        const exists = await db.task.findFirst({
          where: { organizationId, contactId: c.id, automated: true, done: false, kind: "FOLLOWUP" },
        });
        if (exists) continue;
        await db.task.create({
          data: {
            organizationId,
            contactId: c.id,
            userId: c.ownerId ?? undefined,
            title: `Relancer ${c.firstName} ${c.lastName} (sans contact depuis ${rule.delayDays}j)`,
            kind: "FOLLOWUP",
            priority: rule.priority,
            automated: true,
            dueAt: now,
          },
        });
        created++;
      }
    }

    if (rule.condition === "MANDATE_EXPIRING") {
      const soon = new Date(now.getTime() + rule.delayDays * 864e5);
      const mandates = await db.mandate.findMany({
        where: { organizationId, status: "ACTIVE", expiresAt: { lte: soon, gte: now } },
        include: { property: true },
      });
      for (const m of mandates) {
        const existing = await db.notification.findFirst({
          where: { organizationId, type: "MANDATE_EXPIRING", link: `/mandats/${m.id}`, read: false },
        });
        if (existing) continue;
        await db.notification.create({
          data: {
            organizationId,
            type: "MANDATE_EXPIRING",
            title: `Mandat ${m.number} bientôt à échéance`,
            body: `${m.property.title} — pensez au renouvellement.`,
            link: `/mandats/${m.id}`,
          },
        });
        created++;
      }
    }
  }

  return created;
}
