import { LeaseDetailSection } from "@/components/leases/lease-detail-section";
import type { DocumentConflictEntry } from "@/lib/lease/lease-detail-audit";
import { operativeFieldLabel } from "@/lib/lease/lease-field-labels";

type LeaseDocumentConflictsProps = Readonly<{
  conflicts: readonly DocumentConflictEntry[];
}>;

export function LeaseDocumentConflicts({ conflicts }: LeaseDocumentConflictsProps) {
  if (conflicts.length === 0) {
    return null;
  }

  return (
    <LeaseDetailSection
      title="Document conflicts"
      description="Two or more instruments proposed different structured values for the same field. The portfolio row keeps the earlier amendment; later contradicting values were not applied."
    >
      <div className="mb-5 rounded-lg border border-amber-200/90 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 shadow-sm ring-1 ring-amber-200/80">
        <p className="font-semibold">Conflicting lease amendments detected.</p>
        <p className="mt-1.5 text-amber-950/90">
          This lease is marked <span className="font-medium">manual review required</span>. Compare the evidence
          below and resolve in your records; ambiguous fields were not auto-resolved.
        </p>
      </div>
      <ul className="space-y-5">
        {conflicts.map((c, idx) => (
          <li key={`${c.field}-${idx}`} className="rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-4">
            <p className="text-sm font-semibold text-slate-900">{operativeFieldLabel(c.field)}</p>
            <ul className="mt-3 space-y-3">
              {c.conflicting_values.map((row, ri) => (
                <li
                  key={`${c.field}-${row.document_id ?? "none"}-${ri}`}
                  className="rounded-lg border border-white bg-white/90 px-3 py-2 shadow-sm"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{row.label}</p>
                  <p className="mt-1 font-mono text-xs text-slate-800">{row.value_preview}</p>
                  {row.snippet ? (
                    <details className="mt-2 group">
                      <summary className="cursor-pointer text-xs font-medium text-sky-800 underline decoration-sky-300 underline-offset-2">
                        Source evidence
                      </summary>
                      <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md border border-slate-100 bg-slate-50 p-2 font-sans text-xs leading-relaxed text-slate-700">
                        {row.snippet}
                      </pre>
                    </details>
                  ) : null}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </LeaseDetailSection>
  );
}
