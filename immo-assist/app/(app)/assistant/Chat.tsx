"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Sparkles, User } from "lucide-react";
import { ask } from "./actions";

type Msg = { role: "user" | "assistant"; text: string };

// Mini-rendu Markdown (gras + listes) sans dépendance.
function render(text: string) {
  return text.split("\n").map((line, i) => {
    const bold = line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    if (line.trim().startsWith("- ")) {
      return <li key={i} className="ml-4 list-disc" dangerouslySetInnerHTML={{ __html: bold.replace(/^\s*-\s/, "") }} />;
    }
    return <p key={i} className="min-h-[2px]" dangerouslySetInnerHTML={{ __html: bold }} />;
  });
}

const STARTERS = [
  "Qui dois-je relancer aujourd'hui ?",
  "Quels sont mes prospects les plus chauds ?",
  "Quels mandats arrivent à expiration ?",
  "Quels acquéreurs correspondent à mon dernier bien ?",
  "Analyse mon activité du mois",
];

export default function Chat() {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", text: "Bonjour 👋 Je suis votre assistant. Posez-moi une question sur **vos** données : prospects, relances, mandats, acquéreurs, activité…" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  const submit = async (q: string) => {
    if (!q.trim() || loading) return;
    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setLoading(true);
    try {
      const res = await ask(q);
      setMessages((m) => [...m, { role: "assistant", text: res.answer }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", text: "Une erreur est survenue. Réessayez." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card flex flex-col h-[calc(100vh-13rem)]">
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
            <div className={`h-8 w-8 shrink-0 rounded-full grid place-items-center ${m.role === "user" ? "bg-ink text-white" : "bg-gold text-ink"}`}>
              {m.role === "user" ? <User size={16} /> : <Sparkles size={16} />}
            </div>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${m.role === "user" ? "bg-ink text-white" : "bg-gray-50 text-gray-700"}`}>
              {render(m.text)}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="h-8 w-8 shrink-0 rounded-full bg-gold grid place-items-center text-ink"><Sparkles size={16} /></div>
            <div className="rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-400">…</div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {messages.length <= 1 && (
        <div className="flex flex-wrap gap-2 px-5 pb-3">
          {STARTERS.map((s) => (
            <button key={s} onClick={() => submit(s)} className="chip border bg-white text-gray-600 hover:bg-gray-50">{s}</button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => { e.preventDefault(); submit(input); }}
        className="flex items-center gap-2 border-t border-[color:var(--border)] p-3"
      >
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Posez votre question…" className="input" />
        <button type="submit" disabled={loading} className="btn-gold shrink-0"><Send size={16} /></button>
      </form>
    </div>
  );
}
