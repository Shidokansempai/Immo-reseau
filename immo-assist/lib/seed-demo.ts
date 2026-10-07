/**
 * Seed de démonstration — marché réunionnais (Sud : Le Tampon, Saint-Pierre,
 * Petite-Île, Saint-Joseph). Données fictives mais réalistes pour que
 * l'application soit immédiatement compréhensible (section 28).
 *
 * Comptes créés :
 *   - admin@immo-assist.re / demo1234   (Admin plateforme)
 *   - jules@immo-assist.re / demo1234   (Admin agence + conseiller)
 *   - lea@immo-assist.re   / demo1234   (Conseillère)
 */
import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const daysAgo = (n: number) => new Date(Date.now() - n * 864e5);
const daysAhead = (n: number) => new Date(Date.now() + n * 864e5);
const hoursAhead = (n: number) => new Date(Date.now() + n * 36e5);
const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];

/**
 * Amorce la base avec les données de démonstration (Sud de La Réunion).
 * Réutilisable par le script CLI (prisma/seed.ts) et par la route protégée
 * /api/admin/seed (déploiement hébergé). Idempotent : sans `force`, ne fait
 * rien si des données existent déjà.
 */
export async function seedDemo(db: PrismaClient, opts: { force?: boolean } = {}) {
  const existing = await db.organization.count();
  if (existing > 0 && !opts.force) {
    return { skipped: true, reason: "Des données existent déjà (passez force=1 pour réinitialiser)." };
  }

  console.log("🌱 Nettoyage…");
  // Ordre de suppression respectant les FK
  await db.auditLog.deleteMany();
  await db.notification.deleteMany();
  await db.document.deleteMany();
  await db.commission.deleteMany();
  await db.event.deleteMany();
  await db.task.deleteMany();
  await db.interaction.deleteMany();
  await db.valuation.deleteMany();
  await db.buyerProfile.deleteMany();
  await db.mandate.deleteMany();
  await db.property.deleteMany();
  await db.messageTemplate.deleteMany();
  await db.automationRule.deleteMany();
  await db.reminderRule.deleteMany();
  await db.integrationSetting.deleteMany();
  await db.contact.deleteMany();
  await db.pipelineStage.deleteMany();
  await db.pipeline.deleteMany();
  await db.user.deleteMany();
  await db.organization.deleteMany();

  const pw = await bcrypt.hash("demo1234", 10);

  // ── Tenant de démo : agence du conseiller ──────────────────────────────────
  console.log("🏢 Organisation + utilisateurs…");
  const org = await db.organization.create({
    data: {
      name: "Jules Fraynal — Immo Réseau Sud",
      slug: "jules-fraynal-sud",
      city: "Le Tampon",
      region: "La Réunion",
      phone: "0692 00 00 00",
      email: "jules@immo-assist.re",
      brandColor: "#c9a24b",
      legalInfo: "Conseiller Immo Réseau · Mandataire 2L Courtage · RSAC Saint-Pierre",
      plan: "PRO_IA",
      subscriptionStatus: "active",
      trialEndsAt: daysAhead(0),
    },
  });

  // Tenant séparé (pour prouver l'isolation multi-tenant)
  const org2 = await db.organization.create({
    data: { name: "Agence Nord Océan", slug: "nord-ocean", city: "Saint-Denis", region: "La Réunion", plan: "PRO", subscriptionStatus: "active" },
  });

  const platformAdmin = await db.user.create({
    data: { name: "Admin Plateforme", email: "admin@immo-assist.re", password: pw, role: "PLATFORM_ADMIN", organizationId: org.id },
  });
  const jules = await db.user.create({
    data: { name: "Jules Fraynal", email: "jules@immo-assist.re", password: pw, role: "AGENCY_ADMIN", phone: "0692 00 00 00", organizationId: org.id },
  });
  const lea = await db.user.create({
    data: { name: "Léa Hoarau", email: "lea@immo-assist.re", password: pw, role: "ADVISOR", phone: "0692 11 22 33", organizationId: org.id },
  });
  // utilisateur de l'autre tenant (données invisibles depuis org)
  await db.user.create({
    data: { name: "Autre Agence", email: "autre@nord-ocean.re", password: pw, role: "AGENCY_ADMIN", organizationId: org2.id },
  });

  const advisors = [jules.id, lea.id];

  // ── Pipeline ────────────────────────────────────────────────────────────────
  console.log("🔀 Pipeline…");
  const pipeline = await db.pipeline.create({ data: { organizationId: org.id, name: "Prospection", isDefault: true } });
  const stageDefs = [
    ["Nouveau prospect", "#94a3b8", false],
    ["Contacté", "#60a5fa", false],
    ["Qualifié", "#2563eb", false],
    ["Rendez-vous", "#8b5cf6", false],
    ["Estimation", "#f59e0b", false],
    ["Mandat proposé", "#c9a24b", false],
    ["Mandat signé", "#16a34a", false],
    ["Vente", "#059669", true],
  ] as const;
  const stages: any[] = [];
  for (let i = 0; i < stageDefs.length; i++) {
    const [name, color, isWon] = stageDefs[i];
    stages.push(await db.pipelineStage.create({ data: { organizationId: org.id, pipelineId: pipeline.id, name, color, order: i, isWon } }));
  }
  const stageByName = (n: string) => stages.find((s) => s.name === n)!;

  // ── Règles de relance & automatisations & modèles ──────────────────────────
  console.log("⚙️  Règles, automatisations, modèles…");
  await db.reminderRule.createMany({
    data: [
      { organizationId: org.id, name: "Sans contact 3 jours → tâche", condition: "NO_CONTACT", delayDays: 3, priority: "NORMAL", action: "TASK" },
      { organizationId: org.id, name: "Sans contact 7 jours → message proposé", condition: "NO_CONTACT", delayDays: 7, priority: "NORMAL", action: "SUGGEST_MESSAGE" },
      { organizationId: org.id, name: "Sans contact 14 jours → relance prioritaire", condition: "NO_CONTACT", delayDays: 14, priority: "HIGH", action: "TASK" },
      { organizationId: org.id, name: "Après estimation → relance J+2", condition: "AFTER_ESTIMATION", delayDays: 2, priority: "HIGH", action: "SUGGEST_MESSAGE" },
      { organizationId: org.id, name: "Après visite → compte rendu", condition: "AFTER_VISIT", delayDays: 0, priority: "NORMAL", action: "TASK" },
      { organizationId: org.id, name: "Mandat expirant → alerte", condition: "MANDATE_EXPIRING", delayDays: 30, priority: "HIGH", action: "TASK" },
    ],
  });
  await db.automationRule.createMany({
    data: [
      { organizationId: org.id, name: "Nouveau prospect → tâche Premier contact", trigger: "NEW_PROSPECT", action: "CREATE_TASK", config: JSON.stringify({ title: "Premier contact", delayDays: 0, priority: "HIGH" }) },
      { organizationId: org.id, name: "Sans réponse 7j → relance", trigger: "NO_REPLY_7D", action: "CREATE_FOLLOWUP", config: JSON.stringify({ title: "Relancer le prospect" }) },
      { organizationId: org.id, name: "Mandat signé → tâches de commercialisation", trigger: "MANDATE_SIGNED", action: "CREATE_TASK", config: JSON.stringify({ title: "Lancer la commercialisation" }) },
      { organizationId: org.id, name: "Visite terminée → compte rendu", trigger: "VISIT_DONE", action: "CREATE_TASK", config: JSON.stringify({ title: "Rédiger le compte rendu de visite" }) },
      { organizationId: org.id, name: "Anniversaire client → message", trigger: "BIRTHDAY", action: "PROPOSE_MESSAGE", config: JSON.stringify({ templateCategory: "anniversaire" }) },
      { organizationId: org.id, name: "Mandat expire < 30j → notification", trigger: "MANDATE_EXPIRING_30D", action: "NOTIFY" },
      { organizationId: org.id, name: "Nouveau bien → alerte acquéreurs", trigger: "NEW_PROPERTY_MATCH", action: "CREATE_ALERT" },
    ],
  });
  await db.messageTemplate.createMany({
    data: [
      { organizationId: org.id, name: "Approche pige SMS", channel: "SMS", category: "approche_pige", body: "Bonjour {{prenom}}, {{conseiller}}, conseiller immobilier sur {{ville}}. J'accompagne des acquéreurs déjà financés sur votre quartier. Ouvert(e) à en parler 2 min ?" },
      { organizationId: org.id, name: "Relance J+7", channel: "SMS", category: "relance_j7", body: "Bonjour {{prenom}}, je reviens vers vous pour votre bien à {{ville}}. Toujours d'actualité ? J'ai peut-être l'acquéreur qu'il vous faut. {{conseiller}}" },
      { organizationId: org.id, name: "Suivi vendeur", channel: "EMAIL", category: "suivi_vendeur", subject: "Point sur la commercialisation de votre bien", body: "Bonjour {{prenom}},\n\nPoint rapide sur la commercialisation de votre bien à {{ville}} : visites, retours acquéreurs, prochaines actions.\n\nBien à vous,\n{{conseiller}}" },
      { organizationId: org.id, name: "Anniversaire", channel: "SMS", category: "anniversaire", body: "Joyeux anniversaire {{prenom}} ! Belle journée à vous. {{conseiller}}" },
    ],
  });
  await db.integrationSetting.createMany({
    data: [
      { organizationId: org.id, key: "ai", enabled: false },
      { organizationId: org.id, key: "dvf", enabled: false },
      { organizationId: org.id, key: "smtp", enabled: false },
      { organizationId: org.id, key: "whatsapp", enabled: false },
      { organizationId: org.id, key: "stripe", enabled: false },
      { organizationId: org.id, key: "maps", enabled: false },
      { organizationId: org.id, key: "google_calendar", enabled: false },
    ],
  });

  // ── Contacts ────────────────────────────────────────────────────────────────
  console.log("👥 Contacts…");
  const cities = ["Le Tampon", "Saint-Pierre", "Petite-Île", "Saint-Joseph", "Saint-Louis"];
  const sources = ["Pige", "Recommandation", "Boîtage", "Porte-à-porte", "Site web", "Salon"];

  type CSeed = {
    firstName: string; lastName: string; type: string; status: string; stage?: string;
    phone?: string; email?: string; city?: string; score?: number; source?: string; tags?: string;
    lastContactDays?: number; nextFollowDays?: number; notes?: string; owner?: string; birthDays?: number;
  };

  const contactSeeds: CSeed[] = [
    { firstName: "Marie-Claude", lastName: "Payet", type: "PROSPECT_SELLER", status: "QUALIFIED", stage: "Estimation", phone: "0692 45 12 78", email: "mc.payet@gmail.com", city: "Le Tampon", score: 82, source: "Pige", tags: "chaud,exclusif-possible", lastContactDays: 2, nextFollowDays: 1, notes: "Vend sa maison T4 secteur Trois-Mares. Divorce en cours, veut aller vite.", owner: jules.id },
    { firstName: "Jean-Bernard", lastName: "Hoareau", type: "PROSPECT_SELLER", status: "CONTACTED", stage: "Contacté", phone: "0692 33 44 55", city: "Saint-Pierre", score: 64, source: "Boîtage", tags: "à-relancer", lastContactDays: 6, nextFollowDays: 0, notes: "Appartement Terre Sainte, estime trop cher pour l'instant.", owner: jules.id },
    { firstName: "Fabrice", lastName: "Grondin", type: "PROSPECT_SELLER", status: "NEW", stage: "Nouveau prospect", phone: "0692 78 90 12", city: "Petite-Île", score: 48, source: "Pige", lastContactDays: 9, nextFollowDays: -1, notes: "Annonce LBC, maison + terrain. Jamais rappelé.", owner: lea.id },
    { firstName: "Sylvie", lastName: "Técher", type: "SELLER", status: "ACTIVE", stage: "Mandat signé", phone: "0692 10 20 30", email: "sylvie.techer@orange.fr", city: "Le Tampon", score: 90, source: "Recommandation", tags: "exclusif", lastContactDays: 3, notes: "Mandat exclusif signé, villa Bras de Pontho.", owner: jules.id },
    { firstName: "Daniel", lastName: "Vienne", type: "SELLER", status: "ACTIVE", stage: "Mandat signé", phone: "0692 55 66 77", email: "d.vienne@gmail.com", city: "Saint-Joseph", score: 76, source: "Porte-à-porte", lastContactDays: 5, notes: "Maison Vincendo, mandat simple.", owner: lea.id },
    { firstName: "Nadège", lastName: "Boyer", type: "PROSPECT_BUYER", status: "QUALIFIED", stage: "Qualifié", phone: "0692 88 99 00", email: "nadege.boyer@gmail.com", city: "Saint-Pierre", score: 71, source: "Site web", tags: "financé", lastContactDays: 4, nextFollowDays: 2, notes: "Cherche T3/T4, budget validé 2L Courtage.", owner: jules.id },
    { firstName: "Olivier", lastName: "Rivière", type: "BUYER", status: "ACTIVE", phone: "0692 23 45 67", email: "o.riviere@gmail.com", city: "Le Tampon", score: 80, source: "Recommandation", tags: "financé,pressé", lastContactDays: 1, notes: "Primo-accédant, prêt accordé.", owner: jules.id },
    { firstName: "Laetitia", lastName: "Fontaine", type: "PROSPECT_BUYER", status: "CONTACTED", stage: "Contacté", phone: "0692 34 56 78", city: "Petite-Île", score: 58, source: "Site web", lastContactDays: 8, nextFollowDays: -1, notes: "Veut du terrain constructible.", owner: lea.id },
    { firstName: "Patrick", lastName: "Lauret", type: "INVESTOR", status: "ACTIVE", phone: "0692 67 89 01", email: "p.lauret@invest.re", city: "Saint-Pierre", score: 85, source: "Recommandation", tags: "financé,récurrent", lastContactDays: 10, nextFollowDays: 0, notes: "Investisseur locatif, cherche du rendement (Pinel/LMNP).", owner: jules.id },
    { firstName: "Christine", lastName: "Maillot", type: "CLIENT", status: "WON", phone: "0692 12 34 56", email: "c.maillot@gmail.com", city: "Le Tampon", score: 100, source: "Recommandation", notes: "A acheté via l'agence en 2024. Satisfaite, bonne source de recommandations.", owner: jules.id, birthDays: 0 },
    { firstName: "Émilie", lastName: "Robert", type: "REFERRER", status: "ACTIVE", phone: "0692 90 12 34", email: "emilie.robert@banque.re", city: "Saint-Pierre", score: 70, source: "Partenaire", notes: "Conseillère bancaire — apporte des vendeurs.", owner: jules.id },
    { firstName: "Maître", lastName: "Hoarau", type: "NOTARY", status: "ACTIVE", phone: "0262 35 00 00", email: "etude.hoarau@notaires.re", city: "Saint-Pierre", notes: "Notaire partenaire pour les compromis.", owner: jules.id },
    { firstName: "Thierry", lastName: "Courtage", type: "BROKER", status: "ACTIVE", phone: "0692 2L 00 00", email: "contact@2lcourtage.re", city: "Saint-Pierre", notes: "2L Courtage — financement acquéreurs.", owner: jules.id },
    { firstName: "Brigitte", lastName: "Dalleau", type: "PROSPECT_SELLER", status: "CONTACTED", stage: "Rendez-vous", phone: "0692 44 55 66", city: "Saint-Joseph", score: 67, source: "Pige", tags: "RDV-estimation", lastContactDays: 1, nextFollowDays: 3, notes: "RDV estimation pris pour la villa Langevin.", owner: lea.id },
    { firstName: "Willy", lastName: "Sautron", type: "PROSPECT_SELLER", status: "NEW", stage: "Nouveau prospect", phone: "0692 77 88 99", city: "Le Tampon", score: 40, source: "Boîtage", lastContactDays: 15, nextFollowDays: -2, notes: "Flyer déposé, pas encore de retour.", owner: jules.id },
    { firstName: "Sandra", lastName: "Ponamalé", type: "PROSPECT_BUYER", status: "QUALIFIED", stage: "Qualifié", phone: "0692 15 26 37", email: "s.ponamale@gmail.com", city: "Saint-Pierre", score: 74, source: "Site web", tags: "financé", lastContactDays: 3, nextFollowDays: 5, notes: "Famille, cherche maison 4 chambres avec jardin.", owner: lea.id },
  ];

  const contacts: any[] = [];
  for (const c of contactSeeds) {
    contacts.push(await db.contact.create({
      data: {
        organizationId: org.id,
        firstName: c.firstName, lastName: c.lastName, type: c.type, status: c.status,
        phone: c.phone, email: c.email, city: c.city ?? pick(cities),
        source: c.source ?? pick(sources), tags: c.tags, notes: c.notes, score: c.score ?? 50,
        ownerId: c.owner ?? pick(advisors),
        stageId: c.stage ? stageByName(c.stage).id : undefined,
        lastContactAt: c.lastContactDays != null ? daysAgo(c.lastContactDays) : undefined,
        nextFollowUpAt: c.nextFollowDays != null ? daysAhead(c.nextFollowDays) : undefined,
        birthDate: c.birthDays != null ? new Date(new Date().getFullYear() - 45, new Date().getMonth(), new Date().getDate()) : undefined,
      },
    }));
  }
  const byName = (ln: string) => contacts.find((c) => c.lastName === ln)!;

  // ── Interactions (timeline) ─────────────────────────────────────────────────
  console.log("🕑 Interactions…");
  const interSeed: [string, string, string, string, number][] = [
    ["Payet", "CALL", "OUTBOUND", "Premier contact, intéressée par une estimation", 7],
    ["Payet", "VISIT", "OUTBOUND", "Estimation à domicile réalisée", 2],
    ["Payet", "SMS", "OUTBOUND", "Envoi du récap d'estimation", 1],
    ["Hoareau", "CALL", "OUTBOUND", "Discussion prix, trouve le marché bas", 6],
    ["Técher", "MEETING", "OUTBOUND", "Signature mandat exclusif", 20],
    ["Técher", "VISIT", "INBOUND", "Visite acquéreur — bon retour", 3],
    ["Boyer", "EMAIL", "INBOUND", "Demande d'infos sur un T4 Terre Sainte", 4],
    ["Rivière", "CALL", "OUTBOUND", "Prêt confirmé, prêt à visiter", 1],
    ["Lauret", "CALL", "OUTBOUND", "Point sur les opportunités d'investissement", 10],
  ];
  for (const [ln, type, dir, subject, d] of interSeed) {
    await db.interaction.create({
      data: { organizationId: org.id, contactId: byName(ln).id, userId: jules.id, type, direction: dir, subject, at: daysAgo(d) },
    });
  }

  // ── Biens ─────────────────────────────────────────────────────────────────
  console.log("🏠 Biens…");
  type PSeed = {
    ref: string; title: string; type: string; status: string; city: string; address?: string;
    living: number; land?: number; rooms: number; bed: number; bath: number; price: number;
    feesPct?: number; dpe?: string; condition?: string; features?: string; owner?: string; ownerContact?: string;
    parking?: boolean; pool?: boolean; garage?: boolean; year?: number; listedDays?: number; photo?: string;
  };
  const propSeeds: PSeed[] = [
    { ref: "TAM-2026-001", title: "Villa F5 avec vue — Bras de Pontho", type: "HOUSE", status: "MANDATE_ACTIVE", city: "Le Tampon", address: "12 chemin Bras de Pontho", living: 142, land: 650, rooms: 5, bed: 4, bath: 2, price: 465000, feesPct: 4.5, dpe: "C", condition: "bon", features: "vue mer,calme,proche écoles", owner: jules.id, ownerContact: "Técher", parking: true, garage: true, year: 2012, listedDays: 18, photo: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800" },
    { ref: "STJ-2026-002", title: "Maison créole F4 — Vincendo", type: "HOUSE", status: "MANDATE_ACTIVE", city: "Saint-Joseph", address: "5 rue de Vincendo", living: 98, land: 420, rooms: 4, bed: 3, bath: 1, price: 289000, feesPct: 5, dpe: "D", condition: "à rafraîchir", features: "jardin,calme", owner: lea.id, ownerContact: "Vienne", parking: true, year: 1998, listedDays: 9, photo: "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800" },
    { ref: "STP-2026-003", title: "Appartement T3 — Terre Sainte", type: "APARTMENT", status: "UNDER_OFFER", city: "Saint-Pierre", address: "Résidence Les Alizés, Terre Sainte", living: 68, rooms: 3, bed: 2, bath: 1, price: 238000, feesPct: 4, dpe: "C", condition: "bon", features: "balcon,proche mer,parking", owner: jules.id, parking: true, year: 2016, listedDays: 32, photo: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800" },
    { ref: "PET-2026-004", title: "Terrain constructible 580 m² — Piton", type: "LAND", status: "MANDATE_ACTIVE", city: "Petite-Île", address: "Chemin Piton", living: 0, land: 580, rooms: 0, bed: 0, bath: 0, price: 165000, feesPct: 6, condition: "neuf", features: "constructible,vue", owner: lea.id, listedDays: 5, photo: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800" },
    { ref: "TAM-2026-005", title: "Villa F4 moderne — Trois-Mares", type: "HOUSE", status: "ESTIMATION", city: "Le Tampon", address: "Trois-Mares", living: 115, land: 500, rooms: 4, bed: 3, bath: 2, price: 398000, feesPct: 4.5, dpe: "B", condition: "neuf", features: "piscine,vue mer,garage", owner: jules.id, ownerContact: "Payet", parking: true, pool: true, garage: true, year: 2021, listedDays: 2, photo: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800" },
    { ref: "STP-2026-006", title: "Studio investisseur — centre Saint-Pierre", type: "APARTMENT", status: "SOLD", city: "Saint-Pierre", living: 32, rooms: 1, bed: 1, bath: 1, price: 128000, feesPct: 5, dpe: "D", condition: "bon", features: "centre-ville,loué", owner: jules.id, year: 2008, listedDays: 70, photo: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800" },
  ];
  const properties: any[] = [];
  for (const p of propSeeds) {
    const fees = Math.round((p.price * (p.feesPct ?? 4.5)) / 100);
    properties.push(await db.property.create({
      data: {
        organizationId: org.id, reference: p.ref, title: p.title, propertyType: p.type, status: p.status,
        city: p.city, address: p.address, postalCode: p.city === "Le Tampon" ? "97430" : p.city === "Saint-Pierre" ? "97410" : undefined,
        livingArea: p.living || null, landArea: p.land ?? null, rooms: p.rooms || null, bedrooms: p.bed || null, bathrooms: p.bath || null,
        hasParking: p.parking ?? false, hasGarage: p.garage ?? false, hasPool: p.pool ?? false, yearBuilt: p.year ?? null,
        condition: p.condition, dpe: p.dpe, price: p.price, fees, feesPct: p.feesPct ?? 4.5,
        description: `${p.title}. ${p.features?.split(",").join(", ")}.`, features: p.features,
        photoUrl: p.photo, listedAt: p.listedDays != null ? daysAgo(p.listedDays) : undefined,
        ownerId: p.owner ?? pick(advisors), ownerContactId: p.ownerContact ? byName(p.ownerContact).id : undefined,
      },
    }));
  }
  const propByRef = (r: string) => properties.find((p) => p.reference === r)!;

  // ── Mandats ─────────────────────────────────────────────────────────────────
  console.log("📄 Mandats…");
  const mandateSeeds: [string, string, string, string, number][] = [
    // ref bien, type, status, seller, expiresInDays
    ["TAM-2026-001", "EXCLUSIVE", "ACTIVE", "Técher", 72],
    ["STJ-2026-002", "SIMPLE", "ACTIVE", "Vienne", 25],   // bientôt à échéance → alerte
    ["STP-2026-003", "EXCLUSIVE", "ACTIVE", "", 12],       // très proche échéance
    ["PET-2026-004", "SIMPLE", "ACTIVE", "", 85],
    ["STP-2026-006", "EXCLUSIVE", "SOLD", "", -10],
  ];
  let mn = 40;
  for (const [ref, type, status, seller, exp] of mandateSeeds) {
    const prop = propByRef(ref);
    await db.mandate.create({
      data: {
        organizationId: org.id, number: `M-2026-00${mn++}`, type, status,
        signedAt: daysAgo(90 - exp > 0 ? 90 - exp : 10),
        expiresAt: daysAhead(exp), price: prop.price, fees: prop.fees, feesPct: prop.feesPct,
        propertyId: prop.id, sellerId: seller ? byName(seller).id : prop.ownerContactId ?? undefined,
        ownerId: prop.ownerId ?? jules.id,
      },
    });
  }

  // ── Profils acquéreurs (matching) ───────────────────────────────────────────
  console.log("🎯 Profils acquéreurs…");
  const buyerSeeds: [string, number, number, string, string, number, number, boolean, boolean][] = [
    // lastName, budgetMin, budgetMax, areas, types, minArea, minBed, financingReady, needPool
    ["Boyer", 200000, 280000, "Saint-Pierre,Petite-Île", "APARTMENT,HOUSE", 60, 2, true, false],
    ["Rivière", 350000, 480000, "Le Tampon,Saint-Pierre", "HOUSE", 100, 3, true, true],
    ["Fontaine", 120000, 190000, "Petite-Île,Saint-Joseph", "LAND", 0, 0, false, false],
    ["Lauret", 100000, 260000, "Saint-Pierre", "APARTMENT", 30, 1, true, false],
    ["Ponamalé", 280000, 420000, "Le Tampon,Saint-Pierre,Saint-Joseph", "HOUSE", 90, 4, true, false],
  ];
  for (const [ln, bmin, bmax, areas, types, minArea, minBed, fin, pool] of buyerSeeds) {
    await db.buyerProfile.create({
      data: {
        organizationId: org.id, contactId: byName(ln).id, budgetMin: bmin, budgetMax: bmax,
        areas, propertyTypes: types, minArea: minArea || null, minBedrooms: minBed || null,
        financingReady: fin, needPool: pool, needParking: false,
      },
    });
  }

  // ── Tâches ────────────────────────────────────────────────────────────────
  console.log("✅ Tâches…");
  const taskSeeds: [string, string, string, number, string][] = [
    // title, kind, priority, dueInDays, lastName
    ["Rappeler pour fixer la signature du mandat", "CALL", "HIGH", 0, "Payet"],
    ["Relancer suite estimation (J+2)", "FOLLOWUP", "HIGH", 0, "Payet"],
    ["Rappel prix — envoyer comparables", "CALL", "NORMAL", 0, "Hoareau"],
    ["Préparer bon de visite", "DOCUMENT", "NORMAL", 1, "Rivière"],
    ["Compte rendu de visite à rédiger", "DOCUMENT", "NORMAL", -1, "Técher"],
    ["Relancer — sans réponse", "FOLLOWUP", "NORMAL", -2, "Sautron"],
    ["Envoyer biens correspondants", "FOLLOWUP", "NORMAL", 2, "Ponamalé"],
    ["Appeler pour opportunité investissement", "CALL", "NORMAL", 0, "Lauret"],
  ];
  for (const [title, kind, priority, due, ln] of taskSeeds) {
    await db.task.create({
      data: { organizationId: org.id, title, kind, priority, dueAt: daysAhead(due), contactId: byName(ln).id, userId: byName(ln).ownerId ?? jules.id },
    });
  }
  // quelques tâches terminées (historique)
  await db.task.create({ data: { organizationId: org.id, title: "Estimation réalisée", kind: "ESTIMATION", done: true, dueAt: daysAgo(2), contactId: byName("Payet").id, userId: jules.id } });

  // ── Événements (planning) ───────────────────────────────────────────────────
  console.log("📅 Planning…");
  await db.event.create({ data: { organizationId: org.id, title: "Visite — Villa Bras de Pontho", kind: "VISIT", startAt: hoursAhead(3), endAt: hoursAhead(4), location: "Le Tampon", contactId: byName("Rivière").id, propertyId: propByRef("TAM-2026-001").id, userId: jules.id } });
  await db.event.create({ data: { organizationId: org.id, title: "Estimation — Villa Trois-Mares", kind: "ESTIMATION", startAt: hoursAhead(6), location: "Le Tampon", contactId: byName("Payet").id, propertyId: propByRef("TAM-2026-005").id, userId: jules.id } });
  await db.event.create({ data: { organizationId: org.id, title: "RDV vendeur — estimation Langevin", kind: "SELLER_MEETING", startAt: daysAhead(1), location: "Saint-Joseph", contactId: byName("Dalleau").id, userId: lea.id } });
  await db.event.create({ data: { organizationId: org.id, title: "Signature compromis — T3 Terre Sainte", kind: "SIGNATURE", startAt: daysAhead(3), location: "Étude Me Hoarau, Saint-Pierre", propertyId: propByRef("STP-2026-003").id, userId: jules.id } });
  await db.event.create({ data: { organizationId: org.id, title: "Visite acquéreur — maison Vincendo", kind: "VISIT", startAt: daysAhead(2), location: "Saint-Joseph", contactId: byName("Ponamalé").id, propertyId: propByRef("STJ-2026-002").id, userId: lea.id } });

  // ── Avis de valeur ──────────────────────────────────────────────────────────
  console.log("📊 Avis de valeur…");
  await db.valuation.create({
    data: {
      organizationId: org.id, address: "Trois-Mares", city: "Le Tampon", propertyType: "HOUSE",
      livingArea: 115, landArea: 500, rooms: 4, bedrooms: 3, condition: "neuf", dpe: "B",
      features: "piscine,vue mer,garage", priceLow: 372000, priceMid: 400000, priceHigh: 428000,
      pricePerSqm: 3478, status: "FINALIZED", contactId: byName("Payet").id,
      analysis: JSON.stringify({ note: "Bien neuf avec prestations supérieures, secteur recherché." }),
    },
  });

  // ── Commissions / finances ────────────────────────────────────────────────
  console.log("💶 Commissions…");
  await db.commission.create({ data: { organizationId: org.id, propertyId: propByRef("STP-2026-006").id, salePrice: 128000, fees: 6400, advisorPct: 70, advisorAmount: 4480, agencyAmount: 1920, status: "PAID" } });
  await db.commission.create({ data: { organizationId: org.id, propertyId: propByRef("STP-2026-003").id, salePrice: 238000, fees: 9520, advisorPct: 70, advisorAmount: 6664, agencyAmount: 2856, status: "FORECAST" } });
  await db.commission.create({ data: { organizationId: org.id, propertyId: propByRef("TAM-2026-001").id, salePrice: 465000, fees: 20925, advisorPct: 70, advisorAmount: 14647, agencyAmount: 6278, status: "FORECAST" } });

  // ── Notifications ───────────────────────────────────────────────────────────
  console.log("🔔 Notifications…");
  await db.notification.createMany({
    data: [
      { organizationId: org.id, type: "MANDATE_EXPIRING", title: "Mandat M-2026-0042 bientôt à échéance", body: "Appartement T3 Terre Sainte — expire dans 12 jours.", link: "/mandats" },
      { organizationId: org.id, type: "NEW_PROSPECT", title: "Nouveau prospect vendeur", body: "Willy Sautron (Le Tampon) à qualifier.", link: "/contacts" },
      { organizationId: org.id, type: "BUYER_MATCH", title: "3 acquéreurs correspondent à un bien", body: "Villa F5 Bras de Pontho.", link: "/acquereurs", read: true },
    ],
  });

  // ── Documents ─────────────────────────────────────────────────────────────
  await db.document.createMany({
    data: [
      { organizationId: org.id, name: "Mandat exclusif — Villa Bras de Pontho.pdf", category: "MANDATE", propertyId: propByRef("TAM-2026-001").id, signed: true, signatureStatus: "signed" },
      { organizationId: org.id, name: "Avis de valeur — Trois-Mares.pdf", category: "VALUATION", contactId: byName("Payet").id, signatureStatus: "none" },
      { organizationId: org.id, name: "Bon de visite — O. Rivière.pdf", category: "VISIT_FORM", contactId: byName("Rivière").id, signatureStatus: "pending" },
    ],
  });

  console.log("\n✅ Seed terminé.");
  return {
    skipped: false,
    organization: org.name,
    contacts: contacts.length,
    properties: properties.length,
    login: "jules@immo-assist.re / demo1234",
  };
}
