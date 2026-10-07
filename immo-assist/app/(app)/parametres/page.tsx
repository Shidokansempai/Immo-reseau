import {
  User, Building2, CreditCard, Plug, ShieldCheck, MessageSquare, Check, Lock,
} from "lucide-react";
import { requireAuth, currentOrg } from "@/lib/tenant";
import { db } from "@/lib/db";
import { PageHeader, Card, Badge } from "@/components/ui";
import { PLAN_LABEL, ROLE_LABEL } from "@/lib/format";

export const dynamic = "force-dynamic";

const PLANS = [
  { key: "SOLO", price: "39 €", features: ["CRM & contacts", "Prospection & pipeline", "Biens & mandats", "Tâches & planning"] },
  { key: "PRO", price: "79 €", features: ["Tout Solo", "Avis de valeur", "Relances automatiques", "Automatisations", "Finances"] },
  { key: "PRO_IA", price: "129 €", features: ["Tout Pro", "Assistant IA", "Génération de contenu", "Matching avancé"] },
  { key: "AGENCE", price: "Sur devis", features: ["Multi-collaborateurs", "Rôles & permissions", "Statistiques agence", "Support prioritaire"] },
];

const INTEGRATIONS: Record<string, { label: string; desc: string }> = {
  ai: { label: "Intelligence artificielle", desc: "Assistant & génération de contenu (Anthropic / OpenAI)" },
  dvf: { label: "Données immobilières (DVF / DPE / cadastre)", desc: "Comparables réels pour les avis de valeur" },
  smtp: { label: "Email (SMTP / Gmail / Outlook)", desc: "Envoi d'emails et relances" },
  whatsapp: { label: "WhatsApp Business", desc: "Messages et relances via WhatsApp" },
  stripe: { label: "Stripe", desc: "Abonnements et facturation SaaS" },
  maps: { label: "Cartographie (Mapbox / Google Maps)", desc: "Carte interactive des biens et secteurs" },
  google_calendar: { label: "Google Calendar / Outlook", desc: "Synchronisation du planning" },
};

export default async function ParametresPage() {
  const s = await requireAuth();
  const org = await currentOrg(s);
  const [integrations, users, templates] = await Promise.all([
    db.integrationSetting.findMany({ where: { organizationId: s.organizationId } }),
    db.user.findMany({ where: { organizationId: s.organizationId } }),
    db.messageTemplate.findMany({ where: { organizationId: s.organizationId } }),
  ]);

  return (
    <div>
      <PageHeader title="Paramètres" subtitle="Profil, agence, abonnement, intégrations et conformité." />

      <div className="space-y-8">
        {/* Profil & agence */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <h2 className="font-bold flex items-center gap-2 mb-4"><User size={18} /> Profil</h2>
            <dl className="space-y-2.5 text-sm">
              <Line label="Nom" value={s.name} />
              <Line label="Email" value={s.email} />
              <Line label="Rôle" value={ROLE_LABEL[s.role] ?? s.role} />
            </dl>
          </Card>
          <Card>
            <h2 className="font-bold flex items-center gap-2 mb-4"><Building2 size={18} /> Agence</h2>
            <dl className="space-y-2.5 text-sm">
              <Line label="Nom" value={org?.name} />
              <Line label="Ville" value={`${org?.city ?? ""}, ${org?.region ?? ""}`} />
              <Line label="Téléphone" value={org?.phone} />
              <Line label="Collaborateurs" value={`${users.length}`} />
              <Line label="Branding" value={<span className="inline-flex items-center gap-2">{org?.brandColor} <span className="h-4 w-4 rounded" style={{ background: org?.brandColor ?? "#ccc" }} /></span>} />
            </dl>
          </Card>
        </div>

        {/* Abonnement */}
        <div>
          <h2 className="font-bold flex items-center gap-2 mb-4"><CreditCard size={18} /> Abonnement</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {PLANS.map((p) => {
              const current = org?.plan === p.key;
              return (
                <Card key={p.key} className={current ? "ring-2 ring-gold" : ""}>
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold">{PLAN_LABEL[p.key]}</h3>
                    {current && <Badge tone="gold">Actuel</Badge>}
                  </div>
                  <div className="mt-1 text-2xl font-black">{p.price}<span className="text-sm font-normal text-gray-400">{p.key !== "AGENCE" ? "/mois" : ""}</span></div>
                  <ul className="mt-3 space-y-1.5 text-sm text-gray-600">
                    {p.features.map((f) => <li key={f} className="flex items-start gap-1.5"><Check size={15} className="text-emerald-500 mt-0.5 shrink-0" /> {f}</li>)}
                  </ul>
                </Card>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-gray-400">Facturation via Stripe (architecture prête). Statut actuel : {org?.subscriptionStatus}.</p>
        </div>

        {/* Intégrations */}
        <div>
          <h2 className="font-bold flex items-center gap-2 mb-2"><Plug size={18} /> Intégrations</h2>
          <p className="text-sm text-gray-500 mb-4 flex items-center gap-1.5">
            <Lock size={14} /> Les clés API sont stockées côté serveur, jamais exposées au frontend.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {integrations.map((i) => {
              const meta = INTEGRATIONS[i.key];
              if (!meta) return null;
              return (
                <Card key={i.id} className="py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-sm">{meta.label}</div>
                      <div className="text-xs text-gray-400">{meta.desc}</div>
                    </div>
                    <Badge tone={i.enabled ? "green" : "gray"}>{i.enabled ? "Connecté" : "À connecter"}</Badge>
                  </div>
                  <button className="btn-ghost mt-3 w-full text-xs" disabled>
                    {i.enabled ? "Gérer" : "Renseigner la clé (variables d'environnement)"}
                  </button>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Modèles de messages */}
        <div>
          <h2 className="font-bold flex items-center gap-2 mb-4"><MessageSquare size={18} /> Modèles de messages</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {templates.map((t) => (
              <Card key={t.id} className="py-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm">{t.name}</span>
                  <Badge tone="blue">{t.channel}</Badge>
                </div>
                <p className="text-xs text-gray-500 line-clamp-2">{t.body}</p>
              </Card>
            ))}
          </div>
        </div>

        {/* RGPD */}
        <div>
          <h2 className="font-bold flex items-center gap-2 mb-4"><ShieldCheck size={18} /> Sécurité & RGPD</h2>
          <Card>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-center gap-2"><Check size={15} className="text-emerald-500" /> Isolation stricte des données entre tenants (chaque requête est filtrée par organisation)</li>
              <li className="flex items-center gap-2"><Check size={15} className="text-emerald-500" /> Authentification sécurisée (mots de passe hachés bcrypt, sessions JWT httpOnly)</li>
              <li className="flex items-center gap-2"><Check size={15} className="text-emerald-500" /> Journal d'audit des actions sensibles</li>
              <li className="flex items-center gap-2"><Check size={15} className="text-emerald-500" /> Gestion des rôles et permissions</li>
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="btn-ghost text-xs" disabled>Exporter mes données</button>
              <button className="btn-ghost text-xs" disabled>Politique de conservation</button>
              <button className="btn-ghost text-xs" disabled>Supprimer le compte</button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Line({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-gray-400">{label}</dt>
      <dd className="font-medium text-right truncate">{value || "—"}</dd>
    </div>
  );
}
