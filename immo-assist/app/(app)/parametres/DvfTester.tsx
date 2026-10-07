"use client";

import { useState } from "react";
import { Plug, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { testDvf } from "../actions";

type Probe = Awaited<ReturnType<typeof testDvf>>;

const PROVIDER_LABEL: Record<string, string> = {
  data_economie: "API officielle (data.economie.gouv.fr)",
  cquest: "API communautaire (cquest)",
  generic: "Backend personnalisé (DVF_API_URL)",
  none: "Aucun fournisseur configuré",
};

export default function DvfTester() {
  const [city, setCity] = useState("Le Tampon");
  const [res, setRes] = useState<Probe | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try { setRes(await testDvf(city)); } finally { setLoading(false); }
  };

  return (
    <div className="mt-3 border-t border-[color:var(--border)] pt-3">
      <div className="flex gap-2">
        <input value={city} onChange={(e) => setCity(e.target.value)} className="input" placeholder="Commune (ex. Le Tampon)" />
        <button onClick={run} disabled={loading} className="btn-ghost shrink-0 text-xs">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Plug size={14} />} Tester
        </button>
      </div>
      {res && (
        <div className={`mt-2 rounded-xl px-3 py-2 text-xs ${res.source === "dvf_live" ? "bg-emerald-50 text-emerald-700" : res.source === "dvf_sample" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>
          <div className="flex items-center gap-1.5 font-semibold">
            {res.source === "dvf_live" ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
            {PROVIDER_LABEL[res.provider] ?? res.provider}
          </div>
          <p className="mt-1">{res.message}</p>
          {res.insee && <p className="mt-0.5 opacity-70">INSEE {res.insee}</p>}
        </div>
      )}
      <p className="mt-2 text-[11px] text-gray-400">
        Activez l'API officielle en définissant <code className="font-mono">DVF_PROVIDER=data_economie</code> côté serveur.
      </p>
    </div>
  );
}
