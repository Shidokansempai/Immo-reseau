"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Zap } from "lucide-react";
import { Badge } from "@/components/ui";
import { TASK_KIND, relativeFR } from "@/lib/format";
import { toggleTask } from "../actions";

type Row = {
  id: string; title: string; kind: string; priority: string; done: boolean;
  dueAt: string | null; automated: boolean;
  contact: { id: string; firstName: string; lastName: string } | null;
};

function Item({ t }: { t: Row }) {
  const [pending, start] = useTransition();
  const overdue = !t.done && t.dueAt && new Date(t.dueAt) < new Date(new Date().setHours(0, 0, 0, 0));
  return (
    <div className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${t.done ? "opacity-50 border-[color:var(--border)]" : "border-[color:var(--border)]"}`}>
      <input
        type="checkbox"
        checked={t.done}
        disabled={pending}
        onChange={() => start(() => toggleTask(t.id))}
        className="h-5 w-5 rounded-md accent-emerald-600 cursor-pointer"
      />
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium truncate ${t.done ? "line-through" : ""}`}>{t.title}</div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span>{TASK_KIND[t.kind] ?? t.kind}</span>
          {t.contact && <Link href={`/contacts/${t.contact.id}`} className="hover:text-azure">· {t.contact.firstName} {t.contact.lastName}</Link>}
          {t.automated && <span className="inline-flex items-center gap-0.5 text-gold-dark"><Zap size={11} /> auto</span>}
        </div>
      </div>
      {t.priority === "HIGH" && !t.done && <Badge tone="red">Prioritaire</Badge>}
      <span className={`text-xs ${overdue ? "text-red-600 font-medium" : "text-gray-400"}`}>{relativeFR(t.dueAt)}</span>
    </div>
  );
}

export default function TaskList({ open, done }: { open: Row[]; done: Row[] }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="section-title mb-2">À traiter ({open.length})</h2>
        <div className="space-y-2">
          {open.map((t) => <Item key={t.id} t={t} />)}
          {open.length === 0 && <p className="text-sm text-gray-400">Rien à traiter. 🎉</p>}
        </div>
      </div>
      {done.length > 0 && (
        <div>
          <h2 className="section-title mb-2">Terminées ({done.length})</h2>
          <div className="space-y-2">{done.map((t) => <Item key={t.id} t={t} />)}</div>
        </div>
      )}
    </div>
  );
}
