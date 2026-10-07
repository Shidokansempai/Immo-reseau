import Link from "next/link";
import { Bell } from "lucide-react";
import { requireAuth } from "@/lib/tenant";
import { db } from "@/lib/db";
import { PageHeader, Card } from "@/components/ui";
import { dateTimeFR } from "@/lib/format";
import MarkRead from "./MarkRead";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const s = await requireAuth();
  const notifications = await db.notification.findMany({
    where: { organizationId: s.organizationId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle="Alertes de mandats, prospects, matchings, documents et paiements."
        action={<MarkRead />}
      />
      <div className="space-y-2">
        {notifications.length === 0 && <p className="text-sm text-gray-400">Aucune notification.</p>}
        {notifications.map((n) => {
          const body = (
            <Card className={`py-3 ${n.read ? "opacity-60" : ""}`}>
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 h-8 w-8 shrink-0 rounded-full grid place-items-center ${n.read ? "bg-gray-100 text-gray-400" : "bg-gold/15 text-gold-dark"}`}><Bell size={15} /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{n.title}</div>
                  {n.body && <div className="text-sm text-gray-500">{n.body}</div>}
                  <div className="text-xs text-gray-400 mt-0.5">{dateTimeFR(n.createdAt)}</div>
                </div>
                {!n.read && <span className="mt-1 h-2 w-2 rounded-full bg-gold" />}
              </div>
            </Card>
          );
          return n.link ? <Link key={n.id} href={n.link}>{body}</Link> : <div key={n.id}>{body}</div>;
        })}
      </div>
    </div>
  );
}
