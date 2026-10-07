"use client";

import { useState } from "react";
import { Sparkles, Copy, Check } from "lucide-react";
import Modal from "@/components/Modal";

type T = { id: string; name: string; channel: string; body: string };

function fill(body: string, vars: Record<string, string>) {
  return body.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
}

export default function MessageTemplates({
  templates,
  contact,
  advisorName,
}: {
  templates: T[];
  contact: { firstName: string; city: string | null };
  advisorName: string;
}) {
  const vars = { prenom: contact.firstName, ville: contact.city ?? "votre secteur", conseiller: advisorName };
  const [selected, setSelected] = useState<T | null>(templates[0] ?? null);
  const [copied, setCopied] = useState(false);
  const text = selected ? fill(selected.body, vars) : "";

  return (
    <Modal
      title="Générer un message"
      trigger={<button className="btn-ghost"><Sparkles size={16} /> Modèles & messages</button>}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {templates.map((t) => (
            <button
              key={t.id}
              onClick={() => { setSelected(t); setCopied(false); }}
              className={`chip border ${selected?.id === t.id ? "bg-ink text-white border-ink" : "bg-white text-gray-600"}`}
            >
              {t.name} · {t.channel}
            </button>
          ))}
        </div>
        <textarea
          value={text}
          onChange={() => {}}
          rows={6}
          readOnly
          className="input font-normal leading-relaxed"
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">{text.length} caractères</span>
          <button
            onClick={() => { navigator.clipboard?.writeText(text); setCopied(true); }}
            className="btn-gold"
          >
            {copied ? <><Check size={16} /> Copié</> : <><Copy size={16} /> Copier</>}
          </button>
        </div>
        <p className="text-xs text-gray-400">
          Pour des textes 100 % sur mesure (annonces, scripts d'appel, comptes rendus),
          activez l'IA dans Paramètres → Intégrations.
        </p>
      </div>
    </Modal>
  );
}
