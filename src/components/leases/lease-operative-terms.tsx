import type { ReactNode } from "react";

import { LeaseBreakClausePanel } from "@/components/leases/lease-break-clause-panel";
import { LeaseDetailSection } from "@/components/leases/lease-detail-section";
import { jsonSnippetMap } from "@/lib/lease/lease-detail";
import { snippetEvidenceForField } from "@/lib/lease/lease-detail-audit";
import type { FieldProvenanceEntry } from "@/lib/lease/lease-detail-audit";
import { formatOperativeFieldLines } from "@/lib/lease/format-operative-field-value";
import {
  confidenceBand,
  effectiveFieldConfidence,
  parseFieldExtractionMeta,
  parseDateFieldConfidence,
  type ConfidenceBand,
  type DateFieldConfidenceMap,
  type FieldExtractionMetaEntry,
} from "@/lib/lease/field-extraction-meta";
import { operativeFieldLabel } from "@/lib/lease/lease-field-labels";
import type { Tables } from "@/lib/supabase/database.types";

const confidenceBadge: Record<
  ConfidenceBand,
  { label: string; className: string }
> = {
  high: {
    label: "High confidence",
    className: "bg-emerald-50 text-emerald-950 ring-1 ring-inset ring-emerald-200/90",
  },
  medium: {
    label: "Moderate confidence",
    className: "bg-amber-50 text-amber-950 ring-1 ring-inset ring-amber-200/80",
  },
  low: {
    label: "Low confidence",
    className: "bg-orange-50 text-orange-950 ring-1 ring-inset ring-orange-200/80",
  },
  unrated: {
    label: "Confidence n/a",
    className: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200/90",
  },
};

const DATE_OPERATIVE_FIELDS = new Set([
  "term_commencement_date",
  "rent_commencement_date",
  "expiry_date",
  "rent_review_dates",
  "notice_period_days",
]);

function ExtractionConfidencePill(props: Readonly<{ band: ConfidenceBand }>) {
  const b = confidenceBadge[props.band];
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${b.className}`}
    >
      {b.label}
    </span>
  );
}

function formatEffectiveLine(prov: FieldProvenanceEntry | undefined): string | null {
  if (!prov?.source_label) {
    return null;
  }
  const d = prov.effective_date
    ? new Date(`${prov.effective_date}T12:00:00Z`).toLocaleDateString("en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;
  return d ? `Source instrument: ${prov.source_label} · effective ${d}` : `Source instrument: ${prov.source_label}`;
}

function formatValueForField(
  field: string,
  extracted: Tables<"extracted_data">,
): { lines: string[]; isMultiline: boolean } {
  const lines = formatOperativeFieldLines(field, extracted);
  const isMultiline =
    lines.length > 1 ||
    field === "repairing_obligation" ||
    field === "service_charge_responsibility" ||
    field === "conditional_break_clause";
  return { lines, isMultiline };
}

function OperativeBlock(props: Readonly<{ title: string; children: ReactNode }>) {
  return (
    <div className="border-b border-slate-100 pb-6 last:border-0 last:pb-0">
      <h3 className="text-sm font-semibold tracking-wide text-slate-800">{props.title}</h3>
      <div className="mt-3 space-y-2">{props.children}</div>
    </div>
  );
}

function CollapsibleSection(props: Readonly<{ summary: string; children: ReactNode; defaultOpen?: boolean }>) {
  return (
    <details className="group border-t border-slate-100 bg-slate-50/40">
      <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-100/80 [&::-webkit-details-marker]:hidden">
        <span className="inline-flex w-full items-center justify-between gap-2">
          <span>{props.summary}</span>
          <span className="text-slate-400 transition group-open:rotate-180" aria-hidden>
            ▾
          </span>
        </span>
      </summary>
      <div className="space-y-3 border-t border-slate-100 bg-white px-3 py-3">{props.children}</div>
    </details>
  );
}

function OperativeEvidenceRow(props: Readonly<{
  field: string;
  label: string;
  lines: string[];
  multiline: boolean;
  sourceLine: string | null;
  snippetText: string | undefined;
  allMeta: Record<string, FieldExtractionMetaEntry>;
  globalConfidence: number | null | undefined;
  dateFieldConfidence: DateFieldConfidenceMap;
}>) {
  const eff = effectiveFieldConfidence(props.field, props.allMeta, props.globalConfidence, props.dateFieldConfidence);
  const band = confidenceBand(eff);
  const metaRow = props.allMeta[props.field];
  const clauseRef = metaRow?.clause_reference?.trim();
  const rationale = metaRow?.rationale?.trim();
  const hasClause = Boolean(clauseRef && clauseRef.length > 0);
  const hasSnippet = Boolean(props.snippetText && props.snippetText.trim().length > 0);
  const dateFocused = DATE_OPERATIVE_FIELDS.has(props.field);

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200/90 bg-white ring-1 ring-slate-900/5">
      <div className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{props.label}</p>
          <div className="mt-0.5">
            {props.multiline ? (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-900">{props.lines[0]}</p>
            ) : props.lines.length === 1 ? (
              <p
                className={
                  dateFocused
                    ? "text-lg font-semibold leading-snug tabular-nums text-slate-900"
                    : "text-sm font-semibold text-slate-900"
                }
              >
                {props.lines[0]}
              </p>
            ) : (
              <ul className="list-none space-y-0.5 p-0">
                {props.lines.map((line) => (
                  <li
                    key={line}
                    className={
                      dateFocused
                        ? "text-base font-semibold leading-snug tabular-nums text-slate-900"
                        : "text-sm tabular-nums text-slate-900"
                    }
                  >
                    {line}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {props.sourceLine ? (
            <p className="mt-1 text-[11px] leading-snug text-slate-500">{props.sourceLine}</p>
          ) : null}
        </div>
        <ExtractionConfidencePill band={band} />
      </div>

      {hasClause || hasSnippet ? (
        <CollapsibleSection summary="Source clause & excerpt">
          {hasClause ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Source clause</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-900">{clauseRef}</p>
            </div>
          ) : null}
          {hasSnippet ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Lease excerpt</p>
              <blockquote className="mt-1 border-l-2 border-slate-300 bg-slate-50/90 py-2 pl-3 pr-2 font-serif text-sm italic leading-relaxed text-slate-800">
                {props.snippetText}
              </blockquote>
            </div>
          ) : null}
        </CollapsibleSection>
      ) : null}

      <CollapsibleSection summary="Extraction rationale">
        <p className="text-sm leading-relaxed text-slate-800">
          {rationale && rationale.length > 0 ? rationale : "—"}
        </p>
        {eff != null ? (
          <p className="text-[10px] tabular-nums text-slate-500">
            Model score for this field (0–1): <span className="font-semibold text-slate-700">{eff.toFixed(2)}</span>
          </p>
        ) : null}
      </CollapsibleSection>
    </div>
  );
}

type LeaseOperativeTermsProps = Readonly<{
  leaseId: string;
  extracted: Tables<"extracted_data">;
  provenance: Record<string, FieldProvenanceEntry>;
}>;

export function LeaseOperativeTerms({ leaseId, extracted, provenance }: LeaseOperativeTermsProps) {
  const snippets = jsonSnippetMap(extracted.source_snippets);
  const fieldMeta = parseFieldExtractionMeta(extracted.field_extraction_meta);
  const dateFieldConfidence = parseDateFieldConfidence(extracted.date_field_confidence);

  const financialDateFields = ["rent_commencement_date", "rent_review_dates"] as const;
  const obligationFields = [
    "repairing_obligation",
    "reinstatement_required",
    "service_charge_responsibility",
    "vacant_possession_required",
  ] as const;
  const otherFields = ["conditional_break_clause"] as const;

  const renderRow = (field: string) => {
    const { lines, isMultiline } = formatValueForField(field, extracted);
    const snippetText = snippetEvidenceForField(field, snippets);
    return (
      <OperativeEvidenceRow
        key={field}
        field={field}
        label={operativeFieldLabel(field)}
        lines={lines}
        multiline={isMultiline}
        sourceLine={formatEffectiveLine(provenance[field])}
        snippetText={snippetText}
        allMeta={fieldMeta}
        globalConfidence={extracted.confidence_score}
        dateFieldConfidence={dateFieldConfidence}
      />
    );
  };

  return (
    <LeaseDetailSection
      title="Operative terms & extraction"
      description="Key dates and terms at a glance. Expand source clause, excerpt, or rationale on any row when you need audit detail."
    >
      <div className="rounded-xl border border-slate-200/90 bg-slate-50/50 p-1 sm:p-2">
        <OperativeBlock title="Lease term dates">
          {renderRow("term_commencement_date")}
          {renderRow("expiry_date")}
          <div className="space-y-2">
            <p className="px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Break options</p>
            <LeaseBreakClausePanel leaseId={leaseId} extracted={extracted} />
          </div>
          {renderRow("notice_period_days")}
        </OperativeBlock>
        <OperativeBlock title="Financial dates">{financialDateFields.map((f) => renderRow(f))}</OperativeBlock>
        <OperativeBlock title="Obligations">{obligationFields.map((f) => renderRow(f))}</OperativeBlock>
        <OperativeBlock title="Other provisions">{otherFields.map((f) => renderRow(f))}</OperativeBlock>
      </div>
    </LeaseDetailSection>
  );
}
