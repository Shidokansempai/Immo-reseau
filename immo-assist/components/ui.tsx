import Link from "next/link";
import { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`card p-5 ${className}`}>{children}</div>;
}

export function StatCard({
  label,
  value,
  hint,
  accent = "ink",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  accent?: "ink" | "gold" | "azure" | "green" | "red";
}) {
  const ring: Record<string, string> = {
    ink: "text-ink",
    gold: "text-gold-dark",
    azure: "text-azure",
    green: "text-emerald-600",
    red: "text-red-600",
  };
  return (
    <div className="card p-4">
      <div className="text-xs font-semibold text-gray-500">{label}</div>
      <div className={`stat-value mt-1.5 ${ring[accent]}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-gray-400">{hint}</div>}
    </div>
  );
}

const BADGE_TONES: Record<string, string> = {
  gray: "bg-gray-100 text-gray-700",
  blue: "bg-blue-50 text-blue-700",
  green: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-700",
  gold: "bg-gold/15 text-gold-dark",
  purple: "bg-violet-50 text-violet-700",
};

export function Badge({ children, tone = "gray" }: { children: ReactNode; tone?: keyof typeof BADGE_TONES }) {
  return <span className={`chip ${BADGE_TONES[tone] ?? BADGE_TONES.gray}`}>{children}</span>;
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="card p-10 text-center">
      <p className="font-semibold text-gray-700">{title}</p>
      {hint && <p className="mt-1 text-sm text-gray-500">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function Avatar({ initials, size = 36 }: { initials: string; size?: number }) {
  return (
    <div
      className="shrink-0 rounded-full bg-ink text-white grid place-items-center font-semibold"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials}
    </div>
  );
}

export function LinkButton({ href, children, variant = "primary" }: { href: string; children: ReactNode; variant?: "primary" | "gold" | "ghost" }) {
  const cls = variant === "gold" ? "btn-gold" : variant === "ghost" ? "btn-ghost" : "btn-primary";
  return (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}

export function ProgressBar({ value, tone = "azure" }: { value: number; tone?: "azure" | "gold" | "green" }) {
  const bg = tone === "gold" ? "bg-gold" : tone === "green" ? "bg-emerald-500" : "bg-azure";
  return (
    <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
      <div className={`h-full rounded-full ${bg}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}
