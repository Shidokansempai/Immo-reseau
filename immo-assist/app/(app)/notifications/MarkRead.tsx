"use client";

import { useTransition } from "react";
import { CheckCheck } from "lucide-react";
import { markAllNotificationsRead } from "../actions";

export default function MarkRead() {
  const [pending, start] = useTransition();
  return (
    <button onClick={() => start(() => markAllNotificationsRead())} disabled={pending} className="btn-ghost">
      <CheckCheck size={16} /> Tout marquer comme lu
    </button>
  );
}
