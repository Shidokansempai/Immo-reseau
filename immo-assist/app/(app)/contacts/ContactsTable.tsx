"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Avatar, Badge } from "@/components/ui";
import { CONTACT_TYPE, CONTACT_STATUS, initials, dateFR } from "@/lib/format";

type Row = {
  id: string;
  firstName: string;
  lastName: string;
  type: string;
  status: string;
  city: string | null;
  phone: string | null;
  email: string | null;
  score: number;
  source: string | null;
  lastContactAt: string | null;
};

const TYPE_TONE: Record<string, any> = {
  PROSPECT_SELLER: "amber", SELLER: "gold", PROSPECT_BUYER: "blue", BUYER: "green",
  INVESTOR: "purple", CLIENT: "green", REFERRER: "purple",
};

export default function ContactsTable({ rows }: { rows: Row[] }) {
  const [q, setQ] = useState("");
  const [type, setType] = useState("ALL");

  const filtered = useMemo(() => {
    const needle = q.toLowerCase();
    return rows.filter((r) => {
      if (type !== "ALL" && r.type !== type) return false;
      if (!needle) return true;
      return [r.firstName, r.lastName, r.city, r.phone, r.email, r.source]
        .filter(Boolean)
        .some((f) => String(f).toLowerCase().includes(needle));
    });
  }, [rows, q, type]);

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-[color:var(--border)] p-3">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher…" className="input pl-9" />
        </div>
        <select value={type} onChange={(e) => setType(e.target.value)} className="input w-auto">
          <option value="ALL">Tous les types</option>
          {Object.entries(CONTACT_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <span className="text-sm text-gray-400">{filtered.length} contact(s)</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="th">Contact</th>
              <th className="th hidden md:table-cell">Type</th>
              <th className="th hidden lg:table-cell">Secteur</th>
              <th className="th hidden sm:table-cell">Score</th>
              <th className="th hidden lg:table-cell">Dernier contact</th>
              <th className="th">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--border)]">
            {filtered.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="td">
                  <Link href={`/contacts/${r.id}`} className="flex items-center gap-3">
                    <Avatar initials={initials(r.firstName, r.lastName)} size={34} />
                    <div className="min-w-0">
                      <div className="font-medium truncate">{r.firstName} {r.lastName}</div>
                      <div className="text-xs text-gray-400 truncate">{r.phone || r.email || "—"}</div>
                    </div>
                  </Link>
                </td>
                <td className="td hidden md:table-cell"><Badge tone={TYPE_TONE[r.type] ?? "gray"}>{CONTACT_TYPE[r.type]}</Badge></td>
                <td className="td hidden lg:table-cell text-gray-500">{r.city || "—"}</td>
                <td className="td hidden sm:table-cell">
                  <span className={`font-semibold ${r.score >= 70 ? "text-gold-dark" : r.score >= 50 ? "text-azure" : "text-gray-400"}`}>{r.score}</span>
                </td>
                <td className="td hidden lg:table-cell text-gray-500">{dateFR(r.lastContactAt)}</td>
                <td className="td"><Badge tone={r.status === "WON" ? "green" : r.status === "LOST" ? "red" : "gray"}>{CONTACT_STATUS[r.status]}</Badge></td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="td text-center text-gray-400 py-10">Aucun contact ne correspond.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
