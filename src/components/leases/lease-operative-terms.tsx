import type { ReactNode } from "react";

import { LeaseDetailSection } from "@/components/leases/lease-detail-section";
import { formatIsoDate, jsonStringArray } from "@/lib/lease/lease-detail";
import type { FieldProvenanceEntry } from "@/lib/lease/lease-detail-audit";
import { operativeFieldLabel } from "@/lib/lease/lease-field-labels";
import type { Tables } from "@/lib/supabase/database.types";

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
  return d ? `Modified by ${prov.source_label} (${d})` : `Modified by ${prov.source_label}`;
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
    <div className="border-b border-slate-100 pb-6 last:border-0 last:pb-0">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">{props.title}</h3>
      <div className="mt-4 space-y-6">{props.children}</div>
    </div>
  );
}

function OperativeRow(props: Readonly<{
  label: string;
  lines: string[];
  multiline: boolean;
  sourceLine: string | null;
}>) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/30 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{props.label}</p>
      <div className="mt-1.5 space-y-1">
        {props.multiline ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-900">{props.lines[0]}</p>
        ) : props.lines.length === 1 ? (
          <p className="text-sm font-medium tabular-nums text-slate-900">{props.lines[0]}</p>
        ) : (
          <ul className="list-none space-y-1 p-0">
            {props.lines.map((line) => (
              <li key={line} className="text-sm tabular-nums text-slate-900">
                {line}
              </li>
            ))}
          </ul>
        )}
        {props.sourceLine ? <p className="text-xs text-slate-500">{props.sourceLine}</p> : null}
      </div>
    </div>
  );
}

type LeaseOperativeTermsProps = Readonly<{
  extracted: Tables<"extracted_data">;
  provenance: Record<string, FieldProvenanceEntry>;
}>;

export function LeaseOperativeTerms({ extracted, provenance }: LeaseOperativeTermsProps) {
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

  return (
    <LeaseDetailSection
      title="Current operative terms"
      description="Resolved portfolio view after applying supplemental overrides. Always verify against signed PDFs."
    >
      <OperativeBlock title="Critical dates">
        {criticalFields.map((field) => {
          const { lines, isMultiline } = formatValueForField(field, extracted);
          return (
            <OperativeRow
              key={field}
              label={operativeFieldLabel(field)}
              lines={lines}
              multiline={isMultiline}
              sourceLine={formatEffectiveLine(provenance[field])}
            />
          );
        })}
      </OperativeBlock>
      <OperativeBlock title="Obligations">
        {obligationFields.map((field) => {
          const { lines, isMultiline } = formatValueForField(field, extracted);
          return (
            <OperativeRow
              key={field}
              label={operativeFieldLabel(field)}
              lines={lines}
              multiline={isMultiline}
              sourceLine={formatEffectiveLine(provenance[field])}
            />
          );
        })}
      </OperativeBlock>
    </LeaseDetailSection>
  );
}
