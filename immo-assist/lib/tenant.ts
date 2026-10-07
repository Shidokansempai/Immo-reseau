import "server-only";
import { redirect } from "next/navigation";
import { getSession, type SessionPayload } from "./auth";
import { db } from "./db";

/**
 * Garde d'authentification + contexte tenant.
 * À appeler en tête de chaque page/route protégée. Redirige vers /login si
 * la session est absente. Le `organizationId` retourné DOIT être utilisé dans
 * tous les `where` Prisma — c'est la frontière d'isolation multi-tenant.
 */
export async function requireAuth(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireRole(roles: string[]): Promise<SessionPayload> {
  const session = await requireAuth();
  if (!roles.includes(session.role)) redirect("/dashboard");
  return session;
}

/** Charge l'organisation (tenant) courante. */
export async function currentOrg(session: SessionPayload) {
  return db.organization.findUnique({ where: { id: session.organizationId } });
}

/**
 * Filtre tenant à injecter dans les requêtes. Garantit qu'aucune requête ne
 * franchit la frontière du compte.
 */
export function tenantWhere(session: SessionPayload) {
  return { organizationId: session.organizationId };
}
