import type { ReactNode } from "react";

import {
  confidenceBand,
  effectiveFieldConfidence,
  type ConfidenceBand,
  type DateFieldConfidenceMap,
  type FieldExtractionMetaEntry,
} from "@/lib/lease/field-extraction-meta";

export const operativeTermCardClass =
  "overflow-hidden rounded-lg border border-slate-200/90 bg-white ring-1 ring-slate-900/5";

const confidenceBadge: Record<ConfidenceBand, { label: string; className: string }> = {
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

export function ExtractionConfidencePill(props: Readonly<{ band: ConfidenceBand }>) {
  const b = confidenceBadge[props.band];
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${b.className}`}
    >
      {b.label}
    </span>
  );
}

export function CollapsibleSection(props: Readonly<{ summary: string; children: ReactNode }>) {
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

export function OperativeEvidenceCollapsibles(props: Readonly<{
  field: string;
  snippetText: string | undefined;
  allMeta: Record<string, FieldExtractionMetaEntry>;
  globalConfidence: number | null | undefined;
  dateFieldConfidence: DateFieldConfidenceMap;
}>) {
  const eff = effectiveFieldConfidence(
    props.field,
    props.allMeta,
    props.globalConfidence,
    props.dateFieldConfidence,
  );
  const metaRow = props.allMeta[props.field];
  const clauseRef = metaRow?.clause_reference?.trim();
  const rationale = metaRow?.rationale?.trim();
  const hasClause = Boolean(clauseRef && clauseRef.length > 0);
  const hasSnippet = Boolean(props.snippetText && props.snippetText.trim().length > 0);
  const rationaleText =
    rationale && rationale.length > 0
      ? rationale
      : hasSnippet
        ? "Matched to the source excerpt shown above; no separate model rationale was stored."
        : "—";

  return (
    <>
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
          {rationaleText}
        </p>
        {eff != null ? (
          <p className="text-[10px] tabular-nums text-slate-500">
            Model score for this field (0–1): <span className="font-semibold text-slate-700">{eff.toFixed(2)}</span>
          </p>
        ) : null}
      </CollapsibleSection>
    </>
  );
}

export function fieldConfidenceBand(
  field: string,
  allMeta: Record<string, FieldExtractionMetaEntry>,
  globalConfidence: number | null | undefined,
  dateFieldConfidence: DateFieldConfidenceMap,
): ConfidenceBand {
  return confidenceBand(
    effectiveFieldConfidence(field, allMeta, globalConfidence, dateFieldConfidence),
  );
}
