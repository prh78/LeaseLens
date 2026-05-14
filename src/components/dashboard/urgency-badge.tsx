import type { LeaseNextActionUrgency } from "@/lib/supabase/database.types";

const urgencyStyles: Record<LeaseNextActionUrgency, { label: string; className: string }> = {
  low: { label: "Low", className: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200" },
  medium: { label: "Medium", className: "bg-sky-50 text-sky-900 ring-1 ring-inset ring-sky-200/80" },
  high: { label: "High", className: "bg-amber-50 text-amber-950 ring-1 ring-inset ring-amber-200/80" },
  critical: { label: "Critical", className: "bg-red-50 text-red-950 ring-1 ring-inset ring-red-200/80" },
};

type UrgencyBadgeProps = Readonly<{
  level: LeaseNextActionUrgency;
}>;

export function UrgencyBadge({ level }: UrgencyBadgeProps) {
  const u = urgencyStyles[level];
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${u.className}`}>{u.label}</span>
  );
}
