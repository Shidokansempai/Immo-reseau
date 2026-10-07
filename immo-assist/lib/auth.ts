import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { db } from "./db";

const COOKIE = "immo_session";
const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET || "dev-secret-change-me-please-32-characters-min"
);

export type SessionPayload = {
  userId: string;
  organizationId: string;
  role: string;
  name: string;
  email: string;
};

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 10);
}

export async function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);

  cookies().set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function destroySession() {
  cookies().set(COOKIE, "", { path: "/", maxAge: 0 });
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

/**
 * Authentifie par email/mot de passe et ouvre une session.
 * Renvoie { ok } ou { error }.
 */
export async function login(email: string, password: string) {
  const user = await db.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    include: { organization: true },
  });
  if (!user || !user.active) return { error: "Identifiants invalides." };
  const ok = await verifyPassword(password, user.password);
  if (!ok) return { error: "Identifiants invalides." };

  await createSession({
    userId: user.id,
    organizationId: user.organizationId,
    role: user.role,
    name: user.name,
    email: user.email,
  });
  await db.auditLog.create({
    data: {
      action: "login",
      organizationId: user.organizationId,
      userId: user.id,
    },
  });
  return { ok: true };
}

/**
 * Crée une nouvelle agence (tenant) + son administrateur, puis amorce les
 * données de base (pipeline, règles, modèles). Isolation totale par tenant.
 */
export async function registerOrganization(params: {
  orgName: string;
  name: string;
  email: string;
  password: string;
}) {
  const email = params.email.toLowerCase().trim();
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return { error: "Un compte existe déjà avec cet email." };

  const slug =
    params.orgName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) +
    "-" +
    Math.random().toString(36).slice(2, 6);

  const org = await db.organization.create({
    data: {
      name: params.orgName,
      slug,
      plan: "PRO_IA",
      subscriptionStatus: "trialing",
      trialEndsAt: new Date(Date.now() + 14 * 864e5),
    },
  });

  const user = await db.user.create({
    data: {
      name: params.name,
      email,
      password: await hashPassword(params.password),
      role: "AGENCY_ADMIN",
      organizationId: org.id,
    },
  });

  await seedBaselineForOrg(org.id);

  await createSession({
    userId: user.id,
    organizationId: org.id,
    role: user.role,
    name: user.name,
    email: user.email,
  });
  return { ok: true };
}

/**
 * Amorce les objets de configuration indispensables pour un nouveau tenant :
 * pipeline par défaut, règles de relance, quelques modèles de messages,
 * automatisations standard. (Pas de données fictives ici — réservé au seed démo.)
 */
export async function seedBaselineForOrg(organizationId: string) {
  const pipeline = await db.pipeline.create({
    data: { organizationId, name: "Prospection", isDefault: true },
  });
  const stages = [
    ["Nouveau prospect", "#94a3b8", false],
    ["Contacté", "#60a5fa", false],
    ["Qualifié", "#2563eb", false],
    ["Rendez-vous", "#8b5cf6", false],
    ["Estimation", "#f59e0b", false],
    ["Mandat proposé", "#c9a24b", false],
    ["Mandat signé", "#16a34a", false],
    ["Vente", "#059669", true],
  ] as const;
  await db.pipelineStage.createMany({
    data: stages.map(([name, color, isWon], i) => ({
      organizationId,
      pipelineId: pipeline.id,
      name,
      color,
      order: i,
      isWon,
    })),
  });

  await db.reminderRule.createMany({
    data: [
      { organizationId, name: "Sans contact 3 jours → tâche", condition: "NO_CONTACT", delayDays: 3, priority: "NORMAL", action: "TASK" },
      { organizationId, name: "Sans contact 7 jours → message proposé", condition: "NO_CONTACT", delayDays: 7, priority: "NORMAL", action: "SUGGEST_MESSAGE" },
      { organizationId, name: "Sans contact 14 jours → relance prioritaire", condition: "NO_CONTACT", delayDays: 14, priority: "HIGH", action: "TASK" },
      { organizationId, name: "Après estimation → relance J+2", condition: "AFTER_ESTIMATION", delayDays: 2, priority: "HIGH", action: "SUGGEST_MESSAGE" },
      { organizationId, name: "Après visite → compte rendu", condition: "AFTER_VISIT", delayDays: 0, priority: "NORMAL", action: "TASK" },
      { organizationId, name: "Mandat expirant → alerte", condition: "MANDATE_EXPIRING", delayDays: 30, priority: "HIGH", action: "TASK" },
    ],
  });

  await db.automationRule.createMany({
    data: [
      { organizationId, name: "Nouveau prospect → tâche Premier contact", trigger: "NEW_PROSPECT", action: "CREATE_TASK", config: JSON.stringify({ title: "Premier contact", delayDays: 0, priority: "HIGH" }) },
      { organizationId, name: "Sans réponse 7j → relance", trigger: "NO_REPLY_7D", action: "CREATE_FOLLOWUP", config: JSON.stringify({ title: "Relancer le prospect", delayDays: 0 }) },
      { organizationId, name: "Mandat signé → tâches de commercialisation", trigger: "MANDATE_SIGNED", action: "CREATE_TASK", config: JSON.stringify({ title: "Lancer la commercialisation (photos, annonce, matching)" }) },
      { organizationId, name: "Visite terminée → compte rendu", trigger: "VISIT_DONE", action: "CREATE_TASK", config: JSON.stringify({ title: "Rédiger le compte rendu de visite" }) },
      { organizationId, name: "Mandat expire < 30j → notification", trigger: "MANDATE_EXPIRING_30D", action: "NOTIFY", config: JSON.stringify({}) },
      { organizationId, name: "Nouveau bien → alerte acquéreurs", trigger: "NEW_PROPERTY_MATCH", action: "CREATE_ALERT", config: JSON.stringify({}) },
    ],
  });

  await db.messageTemplate.createMany({
    data: [
      { organizationId, name: "Approche pige SMS", channel: "SMS", category: "approche_pige", body: "Bonjour {{prenom}}, je suis {{conseiller}}, conseiller immobilier dans le secteur de {{ville}}. J'accompagne des acquéreurs déjà financés sur votre quartier. Ouvert(e) à en parler 2 minutes ?" },
      { organizationId, name: "Relance J+7", channel: "SMS", category: "relance_j7", body: "Bonjour {{prenom}}, je reviens vers vous au sujet de votre bien à {{ville}}. Toujours d'actualité ? J'ai peut-être l'acquéreur qu'il vous faut. {{conseiller}}" },
      { organizationId, name: "Suivi vendeur", channel: "EMAIL", category: "suivi_vendeur", subject: "Point sur la commercialisation de votre bien", body: "Bonjour {{prenom}},\n\nVoici un point rapide sur la commercialisation de votre bien à {{ville}}.\n\nBien à vous,\n{{conseiller}}" },
      { organizationId, name: "Anniversaire", channel: "SMS", category: "anniversaire", body: "Joyeux anniversaire {{prenom}} ! Toute mon équipe vous souhaite une très belle journée. {{conseiller}}" },
    ],
  });

  await db.integrationSetting.createMany({
    data: [
      { organizationId, key: "ai", enabled: false },
      { organizationId, key: "dvf", enabled: false },
      { organizationId, key: "smtp", enabled: false },
      { organizationId, key: "whatsapp", enabled: false },
      { organizationId, key: "stripe", enabled: false },
      { organizationId, key: "maps", enabled: false },
      { organizationId, key: "google_calendar", enabled: false },
    ],
  });
}
