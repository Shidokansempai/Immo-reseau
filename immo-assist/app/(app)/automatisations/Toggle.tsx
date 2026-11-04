"use client";

import { useTransition } from "react";
import { toggleAutomation, toggleReminder } from "../actions";

export default function Toggle({ id, enabled, kind }: { id: string; enabled: boolean; kind: "automation" | "reminder" }) {
  const [pending, start] = useTransition();
  const fn = kind === "automation" ? toggleAutomation : toggleReminder;
  return (
    <button
      role="switch"
      aria-checked={enabled}
      disabled={pending}
      onClick={() => start(() => fn(id))}
      className={`relative h-6 w-11 rounded-full transition ${enabled ? "bg-emerald-500" : "bg-gray-300"} disabled:opacity-50`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${enabled ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}
