import { requireAuth } from "@/lib/tenant";
import { isLlmConfigured } from "@/lib/ai";
import { PageHeader, Badge } from "@/components/ui";
import Chat from "./Chat";

export const dynamic = "force-dynamic";

export default async function AssistantPage() {
  await requireAuth();
  const llm = isLlmConfigured();
  return (
    <div>
      <PageHeader
        title="Assistant IA"
        subtitle="Interrogez votre activité en langage naturel."
        action={<Badge tone={llm ? "green" : "gray"}>{llm ? "IA connectée" : "Moteur local"}</Badge>}
      />
      <Chat />
    </div>
  );
}
