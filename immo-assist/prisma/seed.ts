/**
 * Runner CLI du seed de démonstration (`npm run db:seed`).
 * La logique vit dans lib/seed-demo.ts (réutilisée par la route /api/admin/seed).
 */
import { PrismaClient } from "@prisma/client";
import { seedDemo } from "../lib/seed-demo";

const db = new PrismaClient();

seedDemo(db, { force: true })
  .then((r) => {
    console.log("   Connexion démo :", r.login ?? "jules@immo-assist.re / demo1234");
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
