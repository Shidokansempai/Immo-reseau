# Déployer IMMO ASSIST en ligne (SaaS hébergé)

Objectif : obtenir une **URL publique** où te connecter, avec une base
PostgreSQL managée. Compte tenu de l'archi (Next.js + serveur + base), le plus
simple est **Vercel + Neon** (tous deux ont une offre gratuite). ~5 minutes,
sans écrire de code.

---

## Étape 1 — Créer la base PostgreSQL (Neon, gratuit)

1. Va sur **neon.tech**, crée un compte, puis un projet (région Europe).
2. Dans le dashboard, ouvre **Connection Details** et copie **deux** URLs :
   - l'URL **Pooled** (contient `-pooler`) → ce sera `DATABASE_URL`
   - l'URL **Direct** (sans `-pooler`) → ce sera `DIRECT_URL`

> Alternative : **Vercel Postgres** (onglet Storage de Vercel). Dans ce cas
> `DATABASE_URL = POSTGRES_PRISMA_URL` et `DIRECT_URL = POSTGRES_URL_NON_POOLING`.

---

## Étape 2 — Déployer sur Vercel

1. Va sur **vercel.com**, connecte ton compte GitHub.
2. **Add New → Project → Import** le dépôt `Shidokansempai/Immo-reseau`.
3. **Root Directory** : sélectionne **`immo-assist`** (important — l'app est
   dans ce sous-dossier).
4. **Branch** : `claude/real-estate-prospecting-reunion-3rupz5` (ou la branche
   fusionnée).
5. Avant de cliquer *Deploy*, ouvre **Environment Variables** et ajoute :

   | Variable | Valeur |
   |----------|--------|
   | `DATABASE_URL` | l'URL **pooled** de Neon |
   | `DIRECT_URL` | l'URL **direct** de Neon |
   | `AUTH_SECRET` | une chaîne aléatoire (`openssl rand -base64 32`) |
   | `SEED_SECRET` | un mot de passe que tu choisis (pour l'amorçage) |
   | `DVF_PROVIDER` | `data_economie` *(optionnel — active le DVF officiel)* |

6. Clique **Deploy**. Le build crée automatiquement les tables
   (`prisma db push` est inclus dans `vercel-build`).

À la fin, Vercel te donne une URL du type `https://immo-assist-xxxx.vercel.app`.

---

## Étape 3 — Charger les données de démonstration (une fois)

Ouvre dans ton navigateur (en remplaçant par ton URL et ton `SEED_SECRET`) :

```
https://TON-APP.vercel.app/api/admin/seed?secret=TON_SEED_SECRET
```

Tu dois voir un JSON `{"ok":true,...}`. C'est fait.

> Cette route est protégée par `SEED_SECRET` et refuse de réécrire des données
> existantes (ajoute `&force=1` pour réinitialiser volontairement).

---

## Étape 4 — Se connecter

Ouvre `https://TON-APP.vercel.app` et connecte-toi :

- **jules@immo-assist.re** / **demo1234**

Change le mot de passe / crée ta vraie agence depuis l'écran d'inscription.
Pour tester le DVF officiel : **Paramètres → Intégrations → Données
immobilières (DVF) → Tester** avec « Le Tampon ».

---

## Notes production

- **Sécurité** : mets un `AUTH_SECRET` fort et un `SEED_SECRET` non devinable.
  Après l'amorçage initial, tu peux retirer `SEED_SECRET` pour désactiver la route.
- **Comptes de démo** : supprime-les (ou change les mots de passe) avant une
  mise en production réelle.
- **Montée en charge** : Neon + l'URL *pooled* gèrent les connexions serverless.
  Pour de vraies migrations versionnées, remplace `prisma db push` par
  `prisma migrate deploy` (+ un dossier `prisma/migrations`).
- **Autres hébergeurs** : Render / Railway / Fly.io fonctionnent aussi (serveur
  Node persistant + Postgres managé) ; même variables d'environnement.
