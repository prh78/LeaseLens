import type { ReactNode } from "react";

import { LeaseBreakClausePanel } from "@/components/leases/lease-break-clause-panel";
import { LeaseDetailSection } from "@/components/leases/lease-detail-section";
import {
  ExtractionConfidencePill,
  OperativeEvidenceCollapsibles,
  fieldConfidenceBand,
  operativeTermCardClass,
} from "@/components/leases/operative-evidence-parts";
import { jsonSnippetMap } from "@/lib/lease/lease-detail";
import { snippetEvidenceForField } from "@/lib/lease/lease-detail-audit";
import type { FieldProvenanceEntry } from "@/lib/lease/lease-detail-audit";
import { formatOperativeFieldLines } from "@/lib/lease/format-operative-field-value";
import { parseFieldExtractionMeta, parseDateFieldConfidence } from "@/lib/lease/field-extraction-meta";
import { operativeFieldLabel } from "@/lib/lease/lease-field-labels";
import type { Tables } from "@/lib/supabase/database.types";

const DATE_OPERATIVE_FIELDS = new Set([
  "term_commencement_date",
  "rent_commencement_date",
  "expiry_date",
  "rent_review_dates",
  "notice_period_days",
]);

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

function OperativeEvidenceRow(props: Readonly<{
  field: string;
  label: string;
  lines: string[];
  multiline: boolean;
  sourceLine: string | null;
  snippetText: string | undefined;
  extracted: Tables<"extracted_data">;
}>) {
  const fieldMeta = parseFieldExtractionMeta(props.extracted.field_extraction_meta);
  const dateFieldConfidence = parseDateFieldConfidence(props.extracted.date_field_confidence);
  const band = fieldConfidenceBand(
    props.field,
    fieldMeta,
    props.extracted.confidence_score,
    dateFieldConfidence,
  );
  const dateFocused = DATE_OPERATIVE_FIELDS.has(props.field);

  return (
    <div className={operativeTermCardClass}>
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

      <OperativeEvidenceCollapsibles
        field={props.field}
        snippetText={props.snippetText}
        allMeta={fieldMeta}
        globalConfidence={props.extracted.confidence_score}
        dateFieldConfidence={dateFieldConfidence}
      />
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
        extracted={extracted}
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
          <LeaseBreakClausePanel leaseId={leaseId} extracted={extracted} />
          {renderRow("notice_period_days")}
        </OperativeBlock>
        <OperativeBlock title="Financial dates">{financialDateFields.map((f) => renderRow(f))}</OperativeBlock>
        <OperativeBlock title="Obligations">{obligationFields.map((f) => renderRow(f))}</OperativeBlock>
        <OperativeBlock title="Other provisions">{otherFields.map((f) => renderRow(f))}</OperativeBlock>
      </div>
    </LeaseDetailSection>
  );
}
