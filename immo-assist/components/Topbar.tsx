import Link from "next/link";
import { Bell, Search } from "lucide-react";
import { db } from "@/lib/db";
import { logoutAction } from "@/app/(auth)/actions";
import { ROLE_LABEL } from "@/lib/format";

export default async function Topbar({ organizationId, userName, role }: { organizationId: string; userName: string; role: string }) {
  const unread = await db.notification.count({ where: { organizationId, read: false } });
  return (
    <header className="sticky top-0 z-20 hidden lg:flex items-center justify-between gap-4 border-b border-[color:var(--border)] bg-white/80 backdrop-blur px-6 py-3">
      <div className="text-sm text-gray-400 flex items-center gap-2">
        <Search size={16} />
        <span>Recherchez un contact, un bien, un mandat…</span>
      </div>
      <div className="flex items-center gap-4">
        <Link href="/notifications" className="relative text-gray-500 hover:text-ink" aria-label="Notifications">
          <Bell size={20} />
          {unread > 0 && (
            <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-gold px-1 text-[10px] font-bold text-ink">
              {unread}
            </span>
          )}
        </Link>
        <div className="h-5 w-px bg-gray-200" />
        <div className="text-right">
          <div className="text-sm font-semibold leading-tight">{userName}</div>
          <div className="text-[11px] text-gray-400">{ROLE_LABEL[role] ?? role}</div>
        </div>
        <form action={logoutAction}>
          <button className="text-sm text-gray-500 hover:text-red-600 font-medium">Déconnexion</button>
        </form>
      </div>
    </header>
  );
}
