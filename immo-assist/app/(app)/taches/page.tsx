import { requireAuth } from "@/lib/tenant";
import { db } from "@/lib/db";
import { runReminderEngine } from "@/lib/reminders";
import { PageHeader } from "@/components/ui";
import TaskList from "./TaskList";
import NewTaskButton from "./NewTaskButton";

export const dynamic = "force-dynamic";

export default async function TachesPage() {
  const s = await requireAuth();
  await runReminderEngine(s.organizationId);

  const [tasks, contacts] = await Promise.all([
    db.task.findMany({
      where: { organizationId: s.organizationId },
      orderBy: [{ done: "asc" }, { priority: "desc" }, { dueAt: "asc" }],
      include: { contact: true },
    }),
    db.contact.findMany({ where: { organizationId: s.organizationId }, orderBy: { lastName: "asc" } }),
  ]);

  const map = (t: (typeof tasks)[number]) => ({
    id: t.id, title: t.title, kind: t.kind, priority: t.priority, done: t.done,
    dueAt: t.dueAt ? t.dueAt.toISOString() : null, automated: t.automated,
    contact: t.contact ? { id: t.contact.id, firstName: t.contact.firstName, lastName: t.contact.lastName } : null,
  });

  return (
    <div>
      <PageHeader
        title="Tâches"
        subtitle="Vos actions, dont celles générées automatiquement par le moteur de relance."
        action={<NewTaskButton contacts={contacts.map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}` }))} />}
      />
      <TaskList open={tasks.filter((t) => !t.done).map(map)} done={tasks.filter((t) => t.done).map(map)} />
    </div>
  );
}
