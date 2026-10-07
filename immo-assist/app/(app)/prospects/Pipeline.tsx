"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Avatar } from "@/components/ui";
import { initials } from "@/lib/format";
import { moveStage } from "../actions";

type Stage = { id: string; name: string; color: string | null; order: number };
type Card = { id: string; firstName: string; lastName: string; city: string | null; score: number; stageId: string | null; phone: string | null };

export default function Pipeline({ stages, cards }: { stages: Stage[]; cards: Card[] }) {
  const [items, setItems] = useState(cards);
  const [, startTransition] = useTransition();

  const move = (cardId: string, dir: -1 | 1) => {
    setItems((prev) =>
      prev.map((c) => {
        if (c.id !== cardId) return c;
        const idx = stages.findIndex((s) => s.id === c.stageId);
        const next = stages[Math.max(0, Math.min(stages.length - 1, idx + dir))];
        if (!next || next.id === c.stageId) return c;
        startTransition(() => moveStage(cardId, next.id));
        return { ...c, stageId: next.id };
      })
    );
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {stages.map((stage) => {
        const col = items.filter((c) => c.stageId === stage.id);
        return (
          <div key={stage.id} className="w-72 shrink-0">
            <div className="flex items-center justify-between mb-2 px-1">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: stage.color ?? "#999" }} />
                <span className="text-sm font-semibold">{stage.name}</span>
              </div>
              <span className="text-xs text-gray-400">{col.length}</span>
            </div>
            <div className="space-y-2 rounded-2xl bg-gray-50/70 p-2 min-h-24">
              {col.map((c) => {
                const idx = stages.findIndex((s) => s.id === stage.id);
                return (
                  <div key={c.id} className="card p-3">
                    <Link href={`/contacts/${c.id}`} className="flex items-center gap-2">
                      <Avatar initials={initials(c.firstName, c.lastName)} size={30} />
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{c.firstName} {c.lastName}</div>
                        <div className="text-xs text-gray-400 truncate">{c.city || "—"} · score {c.score}</div>
                      </div>
                    </Link>
                    <div className="mt-2 flex items-center justify-between">
                      <button onClick={() => move(c.id, -1)} disabled={idx === 0} className="rounded-lg p-1 text-gray-400 enabled:hover:bg-gray-100 disabled:opacity-30" aria-label="Reculer"><ChevronLeft size={16} /></button>
                      <span className={`text-xs font-bold ${c.score >= 70 ? "text-gold-dark" : "text-gray-400"}`}>{c.score}</span>
                      <button onClick={() => move(c.id, 1)} disabled={idx === stages.length - 1} className="rounded-lg p-1 text-gray-400 enabled:hover:bg-gray-100 disabled:opacity-30" aria-label="Avancer"><ChevronRight size={16} /></button>
                    </div>
                  </div>
                );
              })}
              {col.length === 0 && <div className="py-6 text-center text-xs text-gray-300">—</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
