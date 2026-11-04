import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      {/* Panneau marque */}
      <div className="relative hidden lg:flex flex-col justify-between bg-ink p-12 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_30%_20%,#c9a24b,transparent_45%),radial-gradient(circle_at_80%_80%,#2563eb,transparent_45%)]" />
        <div className="relative">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gold grid place-items-center text-ink font-black">IA</div>
            <span className="text-lg font-bold tracking-tight">IMMO ASSIST</span>
          </div>
        </div>
        <div className="relative max-w-md">
          <h1 className="text-3xl font-bold leading-tight">
            L'assistant commercial qui pilote toute votre activité immobilière.
          </h1>
          <p className="mt-4 text-white/70">
            CRM, prospection, mandats, estimations, relances automatiques et
            assistant IA — pensé pour les conseillers indépendants. Moins de
            saisie, plus de ventes.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-white/80">
            <li>• Pipeline de prospection & relances intelligentes</li>
            <li>• Matching acquéreurs ↔ biens en un clic</li>
            <li>• Avis de valeur professionnels</li>
          </ul>
        </div>
        <div className="relative text-xs text-white/50">
          Multi-tenant · Données isolées par compte · RGPD
        </div>
      </div>

      {/* Formulaire */}
      <div className="flex min-h-screen items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8 flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gold grid place-items-center text-ink font-black">IA</div>
            <span className="text-lg font-bold tracking-tight">IMMO ASSIST</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
