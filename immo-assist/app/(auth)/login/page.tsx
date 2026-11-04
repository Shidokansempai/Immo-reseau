"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { loginAction } from "../actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? "Connexion…" : "Se connecter"}
    </button>
  );
}

export default function LoginPage() {
  const [state, action] = useFormState(loginAction, { error: undefined } as { error?: string });
  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight">Connexion</h2>
      <p className="mt-1 text-sm text-gray-500">Accédez à votre espace conseiller.</p>

      <form action={action} className="mt-8 space-y-4">
        <div>
          <label className="label">Email</label>
          <input name="email" type="email" className="input" placeholder="vous@agence.re" defaultValue="jules@immo-assist.re" autoComplete="email" />
        </div>
        <div>
          <label className="label">Mot de passe</label>
          <input name="password" type="password" className="input" placeholder="••••••••" defaultValue="demo1234" autoComplete="current-password" />
        </div>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        <Submit />
      </form>

      <div className="mt-6 rounded-xl bg-gray-50 p-3 text-xs text-gray-500">
        <strong className="text-gray-700">Démo :</strong> jules@immo-assist.re / demo1234
      </div>

      <p className="mt-6 text-sm text-gray-500">
        Pas encore de compte ?{" "}
        <Link href="/register" className="font-semibold text-azure hover:underline">Créer une agence</Link>
      </p>
    </div>
  );
}
