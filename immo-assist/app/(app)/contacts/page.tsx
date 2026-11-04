import { requireAuth } from "@/lib/tenant";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import ContactsTable from "./ContactsTable";
import NewContactButton from "./NewContactButton";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const s = await requireAuth();
  const contacts = await db.contact.findMany({
    where: { organizationId: s.organizationId },
    orderBy: [{ score: "desc" }, { lastName: "asc" }],
  });

  const rows = contacts.map((c) => ({
    id: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
    type: c.type,
    status: c.status,
    city: c.city,
    phone: c.phone,
    email: c.email,
    score: c.score,
    source: c.source,
    lastContactAt: c.lastContactAt ? c.lastContactAt.toISOString() : null,
  }));

  return (
    <div>
      <PageHeader
        title="Contacts"
        subtitle="Toute votre base relationnelle, centralisée."
        action={<NewContactButton />}
      />
      <ContactsTable rows={rows} />
    </div>
  );
}
