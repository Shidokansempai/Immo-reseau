import { requireAuth, currentOrg } from "@/lib/tenant";
import { ROLE_LABEL } from "@/lib/format";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAuth();
  const org = await currentOrg(session);

  return (
    <div className="min-h-screen">
      <Sidebar
        orgName={org?.name ?? "Mon agence"}
        userName={session.name}
        role={ROLE_LABEL[session.role] ?? session.role}
      />
      <div className="lg:pl-64">
        <Topbar organizationId={session.organizationId} userName={session.name} role={session.role} />
        <main className="mx-auto max-w-7xl px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
