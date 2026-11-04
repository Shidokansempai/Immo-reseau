"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { registerAction } from "../actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-gold w-full" disabled={pending}>
      {pending ? "Création…" : "Créer mon espace"}
    </button>
  );
}

export default function RegisterPage() {
  const [state, action] = useFormState(registerAction, { error: undefined } as { error?: string });
  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight">Créer une agence</h2>
      <p className="mt-1 text-sm text-gray-500">14 jours d'essai, sans carte bancaire.</p>

      <form action={action} className="mt-8 space-y-4">
        <div>
          <label className="label">Nom de l'agence / enseigne</label>
          <input name="orgName" className="input" placeholder="Ex. Immo Réseau Sud" />
        </div>
        <div>
          <label className="label">Votre nom</label>
          <input name="name" className="input" placeholder="Prénom Nom" />
        </div>
        <div>
          <label className="label">Email</label>
          <input name="email" type="email" className="input" placeholder="vous@agence.re" autoComplete="email" />
        </div>
        <div>
          <label className="label">Mot de passe</label>
          <input name="password" type="password" className="input" placeholder="6 caractères minimum" autoComplete="new-password" />
        </div>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        <Submit />
      </form>

      <p className="mt-6 text-sm text-gray-500">
        Déjà un compte ?{" "}
        <Link href="/login" className="font-semibold text-azure hover:underline">Se connecter</Link>
      </p>
    </div>
  );
}
