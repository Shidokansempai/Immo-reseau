"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend } from "recharts";

export default function RevenueChart({ data }: { data: { name: string; ca: number; comm: number }[] }) {
  const fmt = (n: number) =>
    new Intl.NumberFormat("fr-FR", { notation: "compact", style: "currency", currency: "EUR", maximumFractionDigits: 1 }).format(n);
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={6}>
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={64} />
          <Tooltip formatter={(v: number) => fmt(v)} cursor={{ fill: "rgba(0,0,0,0.03)" }} contentStyle={{ borderRadius: 12, border: "1px solid #e8eaee", fontSize: 13 }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="ca" name="Chiffre d'affaires" radius={[6, 6, 0, 0]} fill="#2563eb" />
          <Bar dataKey="comm" name="Commissions conseiller" radius={[6, 6, 0, 0]} fill="#c9a24b" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
