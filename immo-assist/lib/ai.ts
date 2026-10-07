import "server-only";
import { db } from "./db";
import { eur, dateFR, daysUntil } from "./format";
import { matchBuyersToProperty } from "./matching";

/**
 * Assistant IA immobilier (section 15).
 *
 * Deux modes :
 *  1. Si une clé LLM est configurée (AI_API_KEY + AI_PROVIDER), on peut router
 *     vers le fournisseur (Anthropic/OpenAI). Hook prêt : callLLM().
 *  2. Sinon, un moteur local déterministe répond aux questions courantes en
 *     interrogeant UNIQUEMENT les données du tenant (organizationId). Aucune
 *     donnée d'un autre compte n'est jamais accessible.
 *
 * Ce choix garantit que l'assistant est utile dès l'installation, sans clé,
 * et que la montée en gamme "Pro IA" se fait en renseignant une variable d'env.
 */

export type AiAnswer = {
  answer: string;
  data?: any;
  source: "local" | "llm";
  suggestions?: string[];
};

const SUGGESTIONS = [
  "Qui dois-je relancer aujourd'hui ?",
  "Quels sont mes prospects les plus chauds ?",
  "Quels mandats arrivent à expiration ?",
  "Analyse mon activité du mois",
];

export async function askAssistant(organizationId: string, question: string): Promise<AiAnswer> {
  const q = question.toLowerCase().trim();

  // ── Qui relancer / relances du jour ──────────────────────────────────────
  if (/(relanc|rappel|à faire|a faire|aujourd)/.test(q)) {
    const now = new Date();
    const end = new Date(); end.setHours(23, 59, 59, 999);
    const [tasks, contacts] = await Promise.all([
      db.task.findMany({
        where: { organizationId, done: false, dueAt: { lte: end } },
        include: { contact: true },
        orderBy: { dueAt: "asc" },
        take: 15,
      }),
      db.contact.findMany({
        where: { organizationId, nextFollowUpAt: { lte: end } },
        orderBy: { nextFollowUpAt: "asc" },
        take: 15,
      }),
    ]);
    const lines: string[] = [];
    if (contacts.length) {
      lines.push(`**${contacts.length} contact(s) à relancer :**`);
      contacts.slice(0, 8).forEach((c) =>
        lines.push(`- ${c.firstName} ${c.lastName}${c.phone ? ` (${c.phone})` : ""} — prévu ${dateFR(c.nextFollowUpAt)}`)
      );
    }
    if (tasks.length) {
      lines.push(`\n**${tasks.length} tâche(s) à traiter :**`);
      tasks.slice(0, 8).forEach((t) =>
        lines.push(`- ${t.title}${t.contact ? ` — ${t.contact.firstName} ${t.contact.lastName}` : ""}`)
      );
    }
    if (!lines.length) return { source: "local", answer: "Rien d'urgent pour aujourd'hui. Profite-en pour prospecter du neuf.", suggestions: SUGGESTIONS };
    return { source: "local", answer: lines.join("\n"), data: { tasks, contacts }, suggestions: SUGGESTIONS };
  }

  // ── Prospects chauds ──────────────────────────────────────────────────────
  if (/(chaud|prioritaire|meilleur prospect|top prospect)/.test(q)) {
    const hot = await db.contact.findMany({
      where: { organizationId, type: { in: ["PROSPECT_SELLER", "PROSPECT_BUYER"] }, status: { notIn: ["LOST", "WON", "INACTIVE"] } },
      orderBy: { score: "desc" },
      take: 8,
      include: { stage: true },
    });
    if (!hot.length) return { source: "local", answer: "Aucun prospect actif pour l'instant.", suggestions: SUGGESTIONS };
    const lines = [`**Tes ${hot.length} prospects les plus chauds :**`];
    hot.forEach((c) => lines.push(`- ${c.firstName} ${c.lastName} — score ${c.score}/100${c.stage ? ` · ${c.stage.name}` : ""}${c.city ? ` · ${c.city}` : ""}`));
    return { source: "local", answer: lines.join("\n"), data: hot, suggestions: SUGGESTIONS };
  }

  // ── Mandats à expiration ──────────────────────────────────────────────────
  if (/(mandat).*(expir|échéance|echeance|fin)|expir.*(mandat)/.test(q)) {
    const soon = new Date(Date.now() + 45 * 864e5);
    const mandates = await db.mandate.findMany({
      where: { organizationId, status: "ACTIVE", expiresAt: { lte: soon } },
      include: { property: true, seller: true },
      orderBy: { expiresAt: "asc" },
    });
    if (!mandates.length) return { source: "local", answer: "Aucun mandat n'arrive à expiration dans les 45 prochains jours.", suggestions: SUGGESTIONS };
    const lines = [`**${mandates.length} mandat(s) à surveiller :**`];
    mandates.forEach((m) => {
      const d = daysUntil(m.expiresAt);
      lines.push(`- ${m.number} — ${m.property.title} · ${m.seller ? m.seller.lastName : "?"} · expire dans ${d} j (${dateFR(m.expiresAt)})`);
    });
    lines.push(`\nConseil : propose un renouvellement en exclusivité avant l'échéance, argument acquéreurs financés à l'appui.`);
    return { source: "local", answer: lines.join("\n"), data: mandates, suggestions: SUGGESTIONS };
  }

  // ── Acquéreurs correspondant à un bien ───────────────────────────────────
  if (/(acqu[eé]reur|acheteur).*(correspond|match|bien)|(correspond|match).*(bien)/.test(q)) {
    const property = await db.property.findFirst({
      where: { organizationId, status: { in: ["MANDATE_ACTIVE", "UNDER_OFFER"] } },
      orderBy: { createdAt: "desc" },
    });
    if (!property) return { source: "local", answer: "Aucun bien actif à matcher pour l'instant.", suggestions: SUGGESTIONS };
    const buyers = await db.buyerProfile.findMany({ where: { organizationId }, include: { contact: true } });
    const matches = matchBuyersToProperty(property, buyers);
    const lines = [`**${matches.length} acquéreur(s) correspondent à "${property.title}" (${eur(property.price)}) :**`];
    matches.slice(0, 8).forEach((m) => lines.push(`- ${m.contact.firstName} ${m.contact.lastName} — ${m.score}% · ${m.reasons.slice(0, 2).join(", ")}`));
    return { source: "local", answer: lines.join("\n"), data: matches, suggestions: SUGGESTIONS };
  }

  // ── Analyse d'activité / CA ───────────────────────────────────────────────
  if (/(analyse|activit|chiffre|ca |performance|bilan|baiss)/.test(q)) {
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const [newContacts, estimations, mandates, sold, commissions, events] = await Promise.all([
      db.contact.count({ where: { organizationId, createdAt: { gte: monthStart } } }),
      db.valuation.count({ where: { organizationId, createdAt: { gte: monthStart } } }),
      db.mandate.count({ where: { organizationId, status: "ACTIVE" } }),
      db.property.count({ where: { organizationId, status: "SOLD" } }),
      db.commission.findMany({ where: { organizationId } }),
      db.event.count({ where: { organizationId, kind: "VISIT", startAt: { gte: monthStart } } }),
    ]);
    const forecast = commissions.filter((c) => c.status !== "PAID").reduce((s, c) => s + (c.advisorAmount ?? 0), 0);
    const realized = commissions.filter((c) => c.status === "PAID").reduce((s, c) => s + (c.advisorAmount ?? 0), 0);
    const lines = [
      `**Activité du mois en cours :**`,
      `- Nouveaux contacts : ${newContacts}`,
      `- Estimations réalisées : ${estimations}`,
      `- Visites : ${events}`,
      `- Mandats actifs : ${mandates}`,
      `- Biens vendus (total) : ${sold}`,
      `\n**Commissions conseiller :**`,
      `- Réalisé : ${eur(realized)}`,
      `- Prévisionnel : ${eur(forecast)}`,
    ];
    if (newContacts < 5) lines.push(`\n⚠️ Peu de nouveaux contacts ce mois : intensifie la pige et le boîtage sur le Sud.`);
    return { source: "local", answer: lines.join("\n"), suggestions: SUGGESTIONS };
  }

  // ── Génération de message / relance / annonce ─────────────────────────────
  if (/(prépare|prepare|rédige|redige|écris|ecris|message|annonce|description|compte rendu|script)/.test(q)) {
    return {
      source: "local",
      answer:
        "Je peux générer ce contenu. Pour des textes sur mesure (annonces, relances, scripts d'appel, comptes rendus), " +
        "active l'IA dans **Paramètres → Intégrations** en renseignant une clé API. " +
        "En attendant, utilise les **modèles de messages** pré-remplis (SMS d'approche pige, relance J+7, suivi vendeur) " +
        "depuis la fiche du contact.",
      suggestions: SUGGESTIONS,
    };
  }

  // ── Défaut ────────────────────────────────────────────────────────────────
  return {
    source: "local",
    answer:
      "Je suis ton assistant sur tes données IMMO ASSIST. Pose-moi une question concrète — " +
      "par exemple l'une de celles ci-dessous. Pour des réponses libres en langage naturel, " +
      "connecte une clé IA dans Paramètres → Intégrations.",
    suggestions: SUGGESTIONS,
  };
}

/**
 * Point d'entrée LLM (désactivé tant qu'aucune clé n'est configurée).
 * On construit un contexte à partir des SEULES données du tenant, puis on
 * appelle le fournisseur. À implémenter lors du branchement d'une vraie clé.
 */
export function isLlmConfigured(): boolean {
  return Boolean(process.env.AI_API_KEY && process.env.AI_PROVIDER);
}
