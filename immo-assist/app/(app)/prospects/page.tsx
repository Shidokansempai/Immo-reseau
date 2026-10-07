import { requireAuth } from "@/lib/tenant";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import NewContactButton from "../contacts/NewContactButton";
import Pipeline from "./Pipeline";

export const dynamic = "force-dynamic";

export default async function ProspectsPage() {
  const s = await requireAuth();

  const pipeline = await db.pipeline.findFirst({
    where: { organizationId: s.organizationId, isDefault: true },
    include: { stages: { orderBy: { order: "asc" } } },
  });

  const stages = pipeline?.stages ?? [];

  const contacts = await db.contact.findMany({
    where: { organizationId: s.organizationId, stageId: { in: stages.map((st) => st.id) } },
    orderBy: { score: "desc" },
  });

  const cards = contacts.map((c) => ({
    id: c.id, firstName: c.firstName, lastName: c.lastName, city: c.city, score: c.score, stageId: c.stageId, phone: c.phone,
  }));

  return (
    <div>
      <PageHeader
        title="Prospection"
        subtitle={`Pipeline « ${pipeline?.name ?? "Prospection"} » — ${contacts.length} prospects en cours.`}
        action={<NewContactButton />}
      />
      {stages.length === 0 ? (
        <p className="text-sm text-gray-400">Aucun pipeline configuré.</p>
      ) : (
        <Pipeline
          stages={stages.map((s) => ({ id: s.id, name: s.name, color: s.color, order: s.order }))}
          cards={cards}
        />
      )}
    </div>
  );
}
