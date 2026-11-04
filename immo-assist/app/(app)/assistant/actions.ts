"use server";

import { requireAuth } from "@/lib/tenant";
import { askAssistant } from "@/lib/ai";

export async function ask(question: string) {
  const s = await requireAuth();
  const res = await askAssistant(s.organizationId, question);
  return { answer: res.answer, source: res.source, suggestions: res.suggestions ?? [] };
}
