"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard, Users, Filter, Building2, FileSignature, Target,
  CheckSquare, Calendar, Calculator, Sparkles, Workflow, Settings,
  Menu, X, Wallet,
} from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/contacts", label: "Contacts (CRM)", icon: Users },
  { href: "/prospects", label: "Prospection", icon: Filter },
  { href: "/biens", label: "Biens", icon: Building2 },
  { href: "/mandats", label: "Mandats", icon: FileSignature },
  { href: "/acquereurs", label: "Acquéreurs", icon: Target },
  { href: "/taches", label: "Tâches", icon: CheckSquare },
  { href: "/planning", label: "Planning", icon: Calendar },
  { href: "/avis-de-valeur", label: "Avis de valeur", icon: Calculator },
  { href: "/finances", label: "Finances", icon: Wallet },
  { href: "/assistant", label: "Assistant IA", icon: Sparkles },
  { href: "/automatisations", label: "Automatisations", icon: Workflow },
  { href: "/parametres", label: "Paramètres", icon: Settings },
];

export default function Sidebar({ orgName, userName, role }: { orgName: string; userName: string; role: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  const Content = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-4 py-5">
        <div className="h-8 w-8 rounded-lg bg-gold grid place-items-center text-ink font-black text-sm">IA</div>
        <div className="min-w-0">
          <div className="text-sm font-bold text-white leading-tight">IMMO ASSIST</div>
          <div className="truncate text-[11px] text-gray-400">{orgName}</div>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            className={`nav-link ${isActive(href) ? "nav-link-active" : ""}`}
          >
            <Icon size={18} className="shrink-0" />
            <span className="truncate">{label}</span>
          </Link>
        ))}
      </nav>

      <div className="border-t border-white/10 px-4 py-3">
        <div className="text-sm font-medium text-white">{userName}</div>
        <div className="text-[11px] text-gray-400">{role}</div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden sticky top-0 z-30 flex items-center justify-between bg-ink px-4 py-3 text-white">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-gold grid place-items-center text-ink font-black text-xs">IA</div>
          <span className="font-bold text-sm">IMMO ASSIST</span>
        </div>
        <button onClick={() => setOpen(true)} aria-label="Menu"><Menu size={22} /></button>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-64 bg-ink">{Content}</aside>

      {/* Mobile drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-ink">
            <button onClick={() => setOpen(false)} className="absolute right-3 top-4 text-white" aria-label="Fermer"><X size={20} /></button>
            {Content}
          </aside>
        </div>
      )}
    </>
  );
}
