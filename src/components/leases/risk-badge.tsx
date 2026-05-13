type RiskBadgeLevel = "low" | "medium" | "high";

const styles: Record<
  RiskBadgeLevel,
  { className: string; label: string }
> = {
  low: {
    className: "border-emerald-200/90 bg-emerald-50 text-emerald-900",
    label: "Low",
  },
  medium: {
    className: "border-amber-200/90 bg-amber-50 text-amber-950",
    label: "Medium",
  },
  high: {
    className: "border-red-200/90 bg-red-50 text-red-950",
    label: "High",
  },
};

type RiskBadgeProps = Readonly<{
  level: RiskBadgeLevel;
  /** When true, shows "Critical" with high-tier styling (DB `critical` maps here). */
  critical?: boolean;
}>;

export function RiskBadge({ level, critical }: RiskBadgeProps) {
  const s = styles[level];
  const label = critical ? "Critical" : s.label;

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold tracking-wide ${s.className}`}
    >
      {label}
    </span>
  );
}
