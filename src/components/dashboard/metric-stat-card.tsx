type MetricStatCardProps = Readonly<{
  label: string;
  value: string | number;
  hint?: string;
  accent?: "default" | "warning" | "danger";
}>;

const accentStyles = {
  default: "border-slate-200",
  warning: "border-amber-200/80 bg-amber-50/40",
  danger: "border-red-200/80 bg-red-50/40",
} as const;

export function MetricStatCard({ label, value, hint, accent = "default" }: MetricStatCardProps) {
  return (
    <div
      className={`rounded-xl border bg-white p-5 shadow-sm ${accentStyles[accent]}`}
      role="region"
      aria-label={label}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-slate-900">{value}</p>
      {hint ? <p className="mt-2 text-sm text-slate-600">{hint}</p> : null}
    </div>
  );
}
