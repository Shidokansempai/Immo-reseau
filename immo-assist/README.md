# IMMO ASSIST

**CRM & assistant commercial immobilier multi-tenant** pour conseillers
indépendants, mandataires et petites agences. Pensé dès le départ comme un
produit SaaS commercialisable — pas une maquette.

Centralise contacts, prospection, biens, mandats, acquéreurs, estimations,
relances et finances, et pilote toute l'activité depuis une seule interface.
Le fil conducteur : **le conseiller saisit le moins possible, le logiciel
déclenche le reste.**

---

## ⚡ Démarrage rapide

```bash
cd immo-assist
cp .env.example .env          # ajuste AUTH_SECRET en production
npm install
npm run setup                 # prisma generate + db push + seed démo
npm run dev                   # http://localhost:3000
```

Build / production :

```bash
npm run build && npm run start
```

### Comptes de démonstration

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Admin agence + conseiller | `jules@immo-assist.re` | `demo1234` |
| Conseillère | `lea@immo-assist.re` | `demo1234` |
| Admin plateforme | `admin@immo-assist.re` | `demo1234` |

Un **second tenant** (`autre@nord-ocean.re`) existe pour démontrer l'isolation
stricte des données entre comptes.

---

## 🧱 Stack technique

- **Next.js 14** (App Router, React Server Components, Server Actions)
- **TypeScript** strict
- **Prisma** ORM — **SQLite** en dev (zéro install), **PostgreSQL-ready** en prod
- **Tailwind CSS** — design premium, responsive mobile/desktop
- **Auth maison** : bcrypt (hash) + JWT httpOnly (`jose`)
- **Recharts** pour les graphiques

Aucune clé API n'est requise pour faire tourner l'application : les
intégrations externes sont modulaires et optionnelles (voir plus bas).

---

## 🔐 Architecture multi-tenant

Chaque donnée métier porte un `organizationId`. C'est la frontière entre
clients.

- `lib/tenant.ts` → `requireAuth()` renvoie la session et l'`organizationId`.
  **Toute** requête Prisma applicative est filtrée par cet identifiant.
- Les pages de détail utilisent `findFirst({ where: { id, organizationId } })` :
  un utilisateur d'un autre tenant obtient un **404**, jamais la donnée.
- Vérifié : un compte ne voit jamais les contacts/biens/mandats d'un autre.

Sécurité & RGPD : mots de passe hachés, sessions signées httpOnly, rôles
(`PLATFORM_ADMIN` / `AGENCY_ADMIN` / `ADVISOR`), journal d'audit (`AuditLog`),
isolation par tenant, `onDelete: Cascade` pour la suppression des données.

---

## 🗂️ Modules (MVP livré)

| Module | Route | Contenu |
|--------|-------|---------|
| **Tableau de bord** | `/dashboard` | 20+ KPI, « À faire aujourd'hui », agenda, alertes, CA/commissions |
| **CRM Contacts** | `/contacts` | Liste filtrable, fiche complète, timeline des interactions, modèles de messages |
| **Prospection** | `/prospects` | Pipeline kanban configurable, déplacement d'étape |
| **Biens** | `/biens` | Fiches détaillées, statuts, matching acquéreurs intégré |
| **Mandats** | `/mandats` | Suivi, alertes d'échéance (J-30/15/7/1), renouvellement |
| **Acquéreurs** | `/acquereurs` | Profils de recherche + **moteur de matching** bien ↔ acquéreur |
| **Tâches** | `/taches` | Création, cochage, tâches auto-générées |
| **Planning** | `/planning` | Agenda des visites, estimations, signatures |
| **Avis de valeur** | `/avis-de-valeur` | Estimation (marché réunionnais) + **rapport PDF brandé** (impression) |
| **Finances** | `/finances` | Commissions, calcul automatique conseiller/agence, CA |
| **Assistant IA** | `/assistant` | Questions en langage naturel sur **vos** données |
| **Automatisations** | `/automatisations` | Règles SI → ALORS + moteur de relance (activables) |
| **Paramètres** | `/parametres` | Profil, agence, plans, intégrations, modèles, RGPD |

---

## 🤖 Intelligence & automatisation

### Moteur de matching (`lib/matching.ts`)
Score pondéré bien ↔ acquéreur (budget 40, secteur 25, type 15, surface 10,
chambres 10 + bonus financement 2L). Affiché en temps réel sur chaque fiche de
bien : « *N acquéreurs correspondent à ce bien* ».

### Moteur de relance (`lib/reminders.ts`)
Idempotent, exécuté au chargement du dashboard et des tâches : matérialise les
relances dues en tâches et les échéances de mandats en notifications. En
production, également branchable sur un cron / une file d'attente.

### Avis de valeur (`lib/valuation.ts`)
Grille de prix/m² calibrée sur le marché réunionnais (Le Tampon, Saint-Pierre,
Petite-Île, Saint-Joseph…), pondérée par l'état, le DPE, le terrain et les
prestations. Produit fourchette, €/m², comparables, analyse de secteur et
arguments. **Architecture prête pour DVF / DPE / cadastre réels.**

### Assistant IA (`lib/ai.ts`)
- **Sans clé** : moteur local déterministe qui répond aux questions courantes
  (« qui relancer », « prospects chauds », « mandats à expiration »,
  « acquéreurs correspondants », « analyse d'activité ») en interrogeant
  **uniquement** les données du tenant.
- **Avec clé** (`AI_PROVIDER` + `AI_API_KEY`) : hook `isLlmConfigured()` prêt à
  router vers un LLM pour des réponses libres et de la génération de contenu.

---

## 🔌 Intégrations externes (modulaires, optionnelles)

Toutes conçues comme des modules remplaçables. **Les clés vivent côté serveur
(variables d'environnement), jamais dans le frontend.** Renseignables plus tard
sans toucher au code métier (voir `.env.example`) :

IA · Données immobilières (DVF/DPE/cadastre) · Email (SMTP/Gmail/Outlook) ·
WhatsApp Business · Stripe (abonnements SOLO 39€ / PRO 79€ / PRO IA 129€ /
AGENCE) · Cartographie (Mapbox/Google Maps) · Google Calendar / Outlook ·
Signature électronique.

L'état de chaque intégration est stocké par tenant (`IntegrationSetting`) et
visible dans Paramètres → Intégrations.

---

## 📁 Structure

```
immo-assist/
├── prisma/
│   ├── schema.prisma        # modèle de données complet (multi-tenant)
│   └── seed.ts              # données de démo réalistes (Sud Réunion)
├── lib/
│   ├── db.ts                # client Prisma (singleton)
│   ├── auth.ts              # sessions, login, inscription, baseline tenant
│   ├── tenant.ts            # garde d'auth + isolation multi-tenant
│   ├── matching.ts          # moteur de matching bien ↔ acquéreurs
│   ├── reminders.ts         # moteur de relance / automatisations
│   ├── valuation.ts         # moteur d'avis de valeur
│   ├── ai.ts                # assistant IA (local + LLM-ready)
│   └── format.ts            # formatage FR + libellés métier
├── components/              # UI partagée (Sidebar, Topbar, Modal, ui kit)
└── app/
    ├── (auth)/              # connexion / inscription
    └── (app)/               # application (dashboard + modules)
```

---

## 🛣️ Suite (post-MVP)

Priorisé dans la spec et préparé architecturalement : WhatsApp, Gmail/Outlook,
Google Calendar, signature électronique, données immobilières avancées,
paiements Stripe, statistiques avancées, portail vendeur, application mobile.

---

## ⚠️ Notes

- `AUTH_SECRET` **doit** être changé en production (`openssl rand -base64 32`).
- La base SQLite (`prisma/dev.db`) est régénérable via `npm run db:reset`.
- Pour PostgreSQL : changer `provider` + `DATABASE_URL` dans `prisma/schema.prisma`
  et `.env`, puis `npm run db:push`.
