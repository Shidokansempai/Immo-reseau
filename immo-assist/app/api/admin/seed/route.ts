import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { seedDemo } from "@/lib/seed-demo";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Amorçage des données de démonstration pour un déploiement hébergé.
 * Protégé par SEED_SECRET (variable d'environnement). À appeler UNE fois après
 * le premier déploiement :
 *   GET /api/admin/seed?secret=VOTRE_SECRET
 *   GET /api/admin/seed?secret=VOTRE_SECRET&force=1   (réinitialise)
 *
 * Sans force, ne fait rien si des données existent déjà (sécurité).
 */
async function handle(req: Request) {
  const secret = process.env.SEED_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "SEED_SECRET n'est pas configuré sur le serveur." },
      { status: 400 }
    );
  }
  const url = new URL(req.url);
  const provided = url.searchParams.get("secret") ?? req.headers.get("x-seed-secret");
  if (provided !== secret) {
    return NextResponse.json({ error: "Secret invalide." }, { status: 401 });
  }
  const force = url.searchParams.get("force") === "1";
  try {
    const result = await seedDemo(db, { force });
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    return NextResponse.json({ error: "Échec du seed", detail: String(e?.message ?? e) }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
