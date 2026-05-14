import type { ReactNode } from "react";

import { LeaseDetailSection } from "@/components/leases/lease-detail-section";
import { formatIsoDate, jsonSnippetMap, jsonStringArray } from "@/lib/lease/lease-detail";
import { snippetEvidenceForField } from "@/lib/lease/lease-detail-audit";
import type { FieldProvenanceEntry } from "@/lib/lease/lease-detail-audit";
import {
  confidenceBand,
  effectiveFieldConfidence,
  parseFieldExtractionMeta,
  type ConfidenceBand,
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
    className: "bg-emerald-100 text-emerald-950 ring-1 ring-inset ring-emerald-200/90",
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
    className: "bg-stone-100 text-stone-600 ring-1 ring-inset ring-stone-200/90",
  },
};

function ExtractionConfidencePill(props: Readonly<{ band: ConfidenceBand }>) {
  const b = confidenceBadge[props.band];
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${b.className}`}
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
    ? new Date(`${prov.effective_date}T12:00:00Z`).toLocaleDateString("en-GB", {
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
  switch (field) {
    case "commencement_date":
    case "expiry_date": {
      const v = field === "commencement_date" ? extracted.commencement_date : extracted.expiry_date;
      const f = formatIsoDate(v);
      return { lines: f ? [f] : ["—"], isMultiline: false };
    }
    case "break_dates": {
      const arr = jsonStringArray(extracted.break_dates);
      const lines = arr.map((d) => formatIsoDate(d)).filter((x): x is string => Boolean(x));
      return { lines: lines.length ? lines : ["—"], isMultiline: lines.length > 1 };
    }
    case "notice_period_days": {
      const n = extracted.notice_period_days;
      if (n == null) {
        return { lines: ["—"], isMultiline: false };
      }
      return { lines: [`${n} day${n === 1 ? "" : "s"}`], isMultiline: false };
    }
    case "rent_review_dates": {
      const arr = jsonStringArray(extracted.rent_review_dates);
      const lines = arr.map((d) => formatIsoDate(d)).filter((x): x is string => Boolean(x));
      return { lines: lines.length ? lines : ["—"], isMultiline: lines.length > 1 };
    }
    case "repairing_obligation": {
      const t = extracted.repairing_obligation?.trim();
      return { lines: [t && t.length > 0 ? t : "—"], isMultiline: true };
    }
    case "service_charge_responsibility": {
      const t = extracted.service_charge_responsibility?.trim();
      return { lines: [t && t.length > 0 ? t : "—"], isMultiline: true };
    }
    case "conditional_break_clause": {
      const t = extracted.conditional_break_clause?.trim();
      return { lines: [t && t.length > 0 ? t : "—"], isMultiline: true };
    }
    case "reinstatement_required":
      return {
        lines: [
          extracted.reinstatement_required == null
            ? "—"
            : extracted.reinstatement_required
              ? "Yes — reinstatement required"
              : "No",
        ],
        isMultiline: false,
      };
    case "vacant_possession_required":
      return {
        lines: [
          extracted.vacant_possession_required == null
            ? "—"
            : extracted.vacant_possession_required
              ? "Yes — vacant possession required"
              : "No",
        ],
        isMultiline: false,
      };
    default:
      return { lines: ["—"], isMultiline: false };
  }
}

function OperativeBlock(props: Readonly<{ title: string; children: ReactNode }>) {
  return (
    <div className="border-b border-stone-200/80 pb-8 last:border-0 last:pb-0">
      <h3 className="font-serif text-sm font-semibold tracking-wide text-stone-800">{props.title}</h3>
      <div className="mt-5 space-y-4">{props.children}</div>
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
  allMeta: Record<string, FieldExtractionMetaEntry>;
  globalConfidence: number | null | undefined;
}>) {
  const eff = effectiveFieldConfidence(props.field, props.allMeta, props.globalConfidence);
  const band = confidenceBand(eff);
  const metaRow = props.allMeta[props.field];
  const clauseRef = metaRow?.clause_reference?.trim();
  const rationale = metaRow?.rationale?.trim();

  return (
    <div className="overflow-hidden rounded-lg border border-stone-200/90 bg-gradient-to-b from-stone-50/40 to-white shadow-sm ring-1 ring-stone-900/[0.04]">
      <div className="flex flex-col gap-3 border-b border-stone-100/90 px-4 py-3.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">{props.label}</p>
          <div className="space-y-1">
            {props.multiline ? (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-stone-900">{props.lines[0]}</p>
            ) : props.lines.length === 1 ? (
              <p className="text-sm font-semibold tabular-nums text-stone-900">{props.lines[0]}</p>
            ) : (
              <ul className="list-none space-y-1 p-0">
                {props.lines.map((line) => (
                  <li key={line} className="text-sm tabular-nums text-stone-900">
                    {line}
                  </li>
                ))}
              </ul>
            )}
            {props.sourceLine ? <p className="text-xs leading-snug text-stone-600">{props.sourceLine}</p> : null}
          </div>
        </div>
        <ExtractionConfidencePill band={band} />
      </div>

      <details className="group border-t border-stone-100 bg-stone-50/30">
        <summary className="cursor-pointer list-none px-4 py-2.5 text-xs font-semibold text-stone-700 transition hover:bg-stone-100/80 [&::-webkit-details-marker]:hidden">
          <span className="inline-flex w-full items-center justify-between gap-2">
            <span className="uppercase tracking-wide text-stone-600">Extraction record</span>
            <span className="text-stone-400 transition group-open:rotate-180" aria-hidden>
              ▾
            </span>
          </span>
        </summary>
        <div className="space-y-4 border-t border-stone-100/80 bg-white/60 px-4 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-500">Clause reference</p>
            <p className="mt-1 font-serif text-sm leading-relaxed text-stone-900">
              {clauseRef && clauseRef.length > 0 ? clauseRef : "—"}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-500">Source excerpt</p>
            {props.snippetText && props.snippetText.trim().length > 0 ? (
              <blockquote className="mt-2 border-l-2 border-stone-300 bg-stone-50/80 py-2 pl-3 pr-2 font-serif text-sm italic leading-relaxed text-stone-800">
                {props.snippetText}
              </blockquote>
            ) : (
              <p className="mt-1 text-sm text-stone-500">No matched snippet stored for this field.</p>
            )}
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-500">Extraction rationale</p>
            <p className="mt-1 text-sm leading-relaxed text-stone-800">
              {rationale && rationale.length > 0 ? rationale : "—"}
            </p>
          </div>
          {eff != null ? (
            <p className="text-[10px] tabular-nums text-stone-500">
              Model score for this field (0–1): <span className="font-semibold text-stone-700">{eff.toFixed(2)}</span>
            </p>
          ) : null}
        </div>
      </details>
    </div>
  );
}

type LeaseOperativeTermsProps = Readonly<{
  extracted: Tables<"extracted_data">;
  provenance: Record<string, FieldProvenanceEntry>;
}>;

export function LeaseOperativeTerms({ extracted, provenance }: LeaseOperativeTermsProps) {
  const snippets = jsonSnippetMap(extracted.source_snippets);
  const fieldMeta = parseFieldExtractionMeta(extracted.field_extraction_meta);

  const criticalFields = [
    "commencement_date",
    "expiry_date",
    "break_dates",
    "notice_period_days",
    "rent_review_dates",
  ] as const;
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
      />
    );
  };

  return (
    <LeaseDetailSection
      title="Current operative terms"
      description="Structured fields with extraction confidence, instrument provenance, and expandable legal-review evidence (clause cite, source excerpt, rationale)."
    >
      <div className="rounded-xl border border-stone-200/80 bg-stone-50/20 p-1 sm:p-2">
        <OperativeBlock title="Critical dates">{criticalFields.map((f) => renderRow(f))}</OperativeBlock>
        <OperativeBlock title="Obligations">{obligationFields.map((f) => renderRow(f))}</OperativeBlock>
        <OperativeBlock title="Other provisions">{otherFields.map((f) => renderRow(f))}</OperativeBlock>
      </div>
    </LeaseDetailSection>
  );
}
