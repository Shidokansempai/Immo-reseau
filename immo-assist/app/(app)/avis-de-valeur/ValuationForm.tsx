"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Calculator } from "lucide-react";
import { createValuation } from "../actions";
import { PROPERTY_TYPE } from "@/lib/format";

export default function ValuationForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <form
      action={async (fd) => {
        setPending(true);
        const id = await createValuation(fd);
        setPending(false);
        if (id) router.push(`/avis-de-valeur/${id}`);
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Adresse</label>
          <input name="address" className="input" placeholder="Rue / lieu-dit" />
        </div>
        <div>
          <label className="label">Ville / secteur</label>
          <input name="city" className="input" placeholder="Le Tampon" defaultValue="Le Tampon" />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="label">Type</label>
          <select name="propertyType" className="input" defaultValue="HOUSE">
            {Object.entries(PROPERTY_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Surface hab. (m²)</label>
          <input name="livingArea" type="number" className="input" placeholder="115" />
        </div>
        <div>
          <label className="label">Terrain (m²)</label>
          <input name="landArea" type="number" className="input" placeholder="500" />
        </div>
        <div>
          <label className="label">Chambres</label>
          <input name="bedrooms" type="number" className="input" placeholder="3" />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="label">Pièces</label>
          <input name="rooms" type="number" className="input" placeholder="4" />
        </div>
        <div>
          <label className="label">État</label>
          <select name="condition" className="input">
            <option value="bon">Bon état</option>
            <option value="neuf">Neuf</option>
            <option value="à rafraîchir">À rafraîchir</option>
            <option value="à rénover">À rénover</option>
          </select>
        </div>
        <div>
          <label className="label">DPE</label>
          <select name="dpe" className="input" defaultValue="C">
            {["A", "B", "C", "D", "E", "F", "G"].map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Prestations</label>
          <input name="features" className="input" placeholder="vue mer,piscine" />
        </div>
      </div>
      <button type="submit" disabled={pending} className="btn-gold w-full sm:w-auto">
        <Calculator size={16} /> {pending ? "Calcul…" : "Calculer l'avis de valeur"}
      </button>
      <p className="text-xs text-gray-400">
        Moteur local calibré sur le marché réunionnais. Branchez DVF / DPE / cadastre (Paramètres → Intégrations) pour des comparables réels.
      </p>
    </form>
  );
}
