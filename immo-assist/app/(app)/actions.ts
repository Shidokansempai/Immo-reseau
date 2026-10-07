"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/tenant";
import { db } from "@/lib/db";
import { estimateValue, type MarketData } from "@/lib/valuation";
import { getDvfMarket } from "@/lib/dvf";

/** Garde d'écriture : garantit que l'entité appartient bien au tenant courant. */
async function ctx() {
  const session = await requireAuth();
  return session;
}

// ─── Tâches ──────────────────────────────────────────────────────────────────
export async function toggleTask(id: string) {
  const s = await ctx();
  const task = await db.task.findFirst({ where: { id, organizationId: s.organizationId } });
  if (!task) return;
  await db.task.update({ where: { id }, data: { done: !task.done } });
  revalidatePath("/taches");
  revalidatePath("/dashboard");
}

export async function createTask(formData: FormData) {
  const s = await ctx();
  const title = String(formData.get("title") || "").trim();
  if (!title) return;
  const due = String(formData.get("dueAt") || "");
  await db.task.create({
    data: {
      organizationId: s.organizationId,
      userId: s.userId,
      title,
      kind: String(formData.get("kind") || "FOLLOWUP"),
      priority: String(formData.get("priority") || "NORMAL"),
      dueAt: due ? new Date(due) : null,
      contactId: (formData.get("contactId") as string) || null,
    },
  });
  revalidatePath("/taches");
  revalidatePath("/dashboard");
}

// ─── Contacts ────────────────────────────────────────────────────────────────
export async function createContact(formData: FormData) {
  const s = await ctx();
  const firstName = String(formData.get("firstName") || "").trim();
  const lastName = String(formData.get("lastName") || "").trim();
  if (!firstName && !lastName) return;

  const defaultStage = await db.pipelineStage.findFirst({
    where: { organizationId: s.organizationId },
    orderBy: { order: "asc" },
  });

  const contact = await db.contact.create({
    data: {
      organizationId: s.organizationId,
      ownerId: s.userId,
      firstName,
      lastName,
      type: String(formData.get("type") || "PROSPECT_SELLER"),
      status: "NEW",
      email: (formData.get("email") as string) || null,
      phone: (formData.get("phone") as string) || null,
      city: (formData.get("city") as string) || null,
      source: (formData.get("source") as string) || null,
      notes: (formData.get("notes") as string) || null,
      score: Number(formData.get("score") || 50),
      stageId: defaultStage?.id ?? null,
      nextFollowUpAt: new Date(),
    },
  });

  // Automatisation : NEW_PROSPECT → tâche "Premier contact"
  const rule = await db.automationRule.findFirst({
    where: { organizationId: s.organizationId, trigger: "NEW_PROSPECT", enabled: true },
  });
  if (rule) {
    await db.task.create({
      data: {
        organizationId: s.organizationId,
        userId: s.userId,
        contactId: contact.id,
        title: "Premier contact",
        kind: "CALL",
        priority: "HIGH",
        automated: true,
        dueAt: new Date(),
      },
    });
  }
  revalidatePath("/contacts");
  revalidatePath("/prospects");
}

export async function logInteraction(formData: FormData) {
  const s = await ctx();
  const contactId = String(formData.get("contactId") || "");
  const contact = await db.contact.findFirst({ where: { id: contactId, organizationId: s.organizationId } });
  if (!contact) return;
  await db.interaction.create({
    data: {
      organizationId: s.organizationId,
      contactId,
      userId: s.userId,
      type: String(formData.get("type") || "NOTE"),
      direction: String(formData.get("direction") || "OUTBOUND"),
      subject: String(formData.get("subject") || "") || null,
      outcome: (formData.get("outcome") as string) || null,
    },
  });
  // Met à jour le dernier contact + reprogramme une relance
  const followDays = Number(formData.get("followDays") || 7);
  await db.contact.update({
    where: { id: contactId },
    data: {
      lastContactAt: new Date(),
      nextFollowUpAt: followDays > 0 ? new Date(Date.now() + followDays * 864e5) : null,
      status: contact.status === "NEW" ? "CONTACTED" : contact.status,
    },
  });
  revalidatePath(`/contacts/${contactId}`);
  revalidatePath("/dashboard");
}

// ─── Pipeline : déplacer un contact d'étape ──────────────────────────────────
export async function moveStage(contactId: string, stageId: string) {
  const s = await ctx();
  const [contact, stage] = await Promise.all([
    db.contact.findFirst({ where: { id: contactId, organizationId: s.organizationId } }),
    db.pipelineStage.findFirst({ where: { id: stageId, organizationId: s.organizationId } }),
  ]);
  if (!contact || !stage) return;
  await db.contact.update({
    where: { id: contactId },
    data: { stageId, status: stage.isWon ? "WON" : contact.status },
  });
  revalidatePath("/prospects");
}

// ─── Mandats : renouveler / mettre à jour échéance ───────────────────────────
export async function renewMandate(id: string, months: number) {
  const s = await ctx();
  const m = await db.mandate.findFirst({ where: { id, organizationId: s.organizationId } });
  if (!m) return;
  const base = m.expiresAt && m.expiresAt > new Date() ? m.expiresAt : new Date();
  await db.mandate.update({
    where: { id },
    data: { expiresAt: new Date(base.getTime() + months * 30 * 864e5), status: "ACTIVE" },
  });
  revalidatePath("/mandats");
  revalidatePath(`/mandats/${id}`);
}

// ─── Avis de valeur : calcul + enregistrement ────────────────────────────────
export async function createValuation(formData: FormData) {
  const s = await ctx();
  const input = {
    address: String(formData.get("address") || "") || null,
    city: String(formData.get("city") || "") || null,
    propertyType: String(formData.get("propertyType") || "HOUSE"),
    livingArea: formData.get("livingArea") ? Number(formData.get("livingArea")) : null,
    landArea: formData.get("landArea") ? Number(formData.get("landArea")) : null,
    bedrooms: formData.get("bedrooms") ? Number(formData.get("bedrooms")) : null,
    condition: String(formData.get("condition") || "") || null,
    dpe: String(formData.get("dpe") || "") || null,
    features: String(formData.get("features") || "") || null,
  };
  // Données de marché DVF réelles (ou échantillon de repli) pour la commune.
  const dvf = await getDvfMarket(input.city, { propertyType: input.propertyType, livingArea: input.livingArea });
  const market: MarketData | null = dvf
    ? {
        source: dvf.source,
        pricePerSqmMedian: dvf.pricePerSqmMedian,
        count: dvf.count,
        comparables: dvf.comparables.map((t) => ({
          label: `${t.type}${t.rooms ? ` ${t.rooms}p` : ""} ${t.area} m²${t.address ? ` — ${t.address}` : ""}`,
          city: input.city ?? dvf.commune,
          area: t.area,
          price: t.price,
          pricePerSqm: t.pricePerSqm,
          soldAt: t.date || "récent",
        })),
      }
    : null;

  const result = estimateValue(input, market);
  const v = await db.valuation.create({
    data: {
      organizationId: s.organizationId,
      ...input,
      rooms: formData.get("rooms") ? Number(formData.get("rooms")) : null,
      priceLow: result.priceLow,
      priceMid: result.priceMid,
      priceHigh: result.priceHigh,
      pricePerSqm: result.pricePerSqm,
      status: "FINALIZED",
      analysis: JSON.stringify(result),
    },
  });
  revalidatePath("/avis-de-valeur");
  return v.id;
}

// ─── Automatisations : activer/désactiver ────────────────────────────────────
export async function toggleAutomation(id: string) {
  const s = await ctx();
  const a = await db.automationRule.findFirst({ where: { id, organizationId: s.organizationId } });
  if (!a) return;
  await db.automationRule.update({ where: { id }, data: { enabled: !a.enabled } });
  revalidatePath("/automatisations");
}

export async function toggleReminder(id: string) {
  const s = await ctx();
  const r = await db.reminderRule.findFirst({ where: { id, organizationId: s.organizationId } });
  if (!r) return;
  await db.reminderRule.update({ where: { id }, data: { enabled: !r.enabled } });
  revalidatePath("/automatisations");
}

// ─── Notifications ───────────────────────────────────────────────────────────
export async function markAllNotificationsRead() {
  const s = await ctx();
  await db.notification.updateMany({ where: { organizationId: s.organizationId, read: false }, data: { read: true } });
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
}
