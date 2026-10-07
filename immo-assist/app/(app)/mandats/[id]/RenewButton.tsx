"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { renewMandate } from "../../actions";

export default function RenewButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button onClick={() => start(() => renewMandate(id, 3))} disabled={pending} className="btn-gold">
      <RefreshCw size={16} /> {pending ? "…" : "Renouveler +3 mois"}
    </button>
  );
}
