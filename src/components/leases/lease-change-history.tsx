import { LeaseDetailSection } from "@/components/leases/lease-detail-section";
import type { ChangeHistoryEntry } from "@/lib/lease/lease-detail-audit";
import { operativeFieldLabel } from "@/lib/lease/lease-field-labels";

function preview(v: unknown): string {
  if (v == null) {
    return "—";
  }
  if (typeof v === "string") {
    return v.length > 160 ? `${v.slice(0, 160)}…` : v;
  }
  const s = JSON.stringify(v);
  return s.length > 160 ? `${s.slice(0, 160)}…` : s;
}

type LeaseChangeHistoryProps = Readonly<{
  entries: readonly ChangeHistoryEntry[];
}>;

export function LeaseChangeHistory({ entries }: LeaseChangeHistoryProps) {
  if (entries.length === 0) {
    return null;
  }

  return (
    <LeaseDetailSection
      title="Change history"
      description="Structured field updates applied from supplemental instruments (most recent analyse pass)."
    >
      <ul className="space-y-4">
        {entries.map((e, idx) => (
          <li
            key={`${e.field}-${e.source_document_id}-${idx}`}
            className="rounded-lg border border-slate-100 bg-white px-4 py-3 shadow-sm"
          >
            <p className="text-sm font-semibold text-slate-900">{operativeFieldLabel(e.field)}</p>
            <p className="mt-2 font-mono text-xs leading-relaxed text-slate-700">
              <span className="text-slate-500">Previous:</span> {preview(e.previous_value)}
            </p>
            <p className="mt-1 font-mono text-xs leading-relaxed text-slate-900">
              <span className="text-slate-500">Updated:</span> {preview(e.new_value)}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Updated by {e.source_label}
              {e.effective_date ? (
                <>
                  {" "}
                  · Effective{" "}
                  {new Date(`${e.effective_date}T12:00:00Z`).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </>
              ) : null}
            </p>
          </li>
        ))}
      </ul>
    </LeaseDetailSection>
  );
}
