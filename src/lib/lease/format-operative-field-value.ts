import { jsonStringArray } from "@/lib/lease/lease-detail";
import {
  BREAK_CLAUSE_STATUS_LABEL,
  effectiveExpiryDate,
  isExpiryOverriddenByServedNotice,
  parseBreakClauseEntryMap,
  tenancyEndFromServedNotice,
} from "@/lib/lease/break-clause-status";
import { formatIsoDate } from "@/lib/lease/lease-detail";
import type { Tables } from "@/lib/supabase/database.types";

/** Field keys rendered under "Current operative terms" (same groupings as the lease UI). */
export const OPERATIVE_TERMS_CRITICAL_FIELDS = [
  "term_commencement_date",
  "rent_commencement_date",
  "expiry_date",
  "break_dates",
  "notice_period_days",
  "rent_review_dates",
] as const;

export const OPERATIVE_TERMS_OBLIGATION_FIELDS = [
  "repairing_obligation",
  "reinstatement_required",
  "service_charge_responsibility",
  "vacant_possession_required",
] as const;

export const OPERATIVE_TERMS_OTHER_FIELDS = ["conditional_break_clause"] as const;

export function formatOperativeFieldLines(field: string, extracted: Tables<"extracted_data">): string[] {
  switch (field) {
    case "term_commencement_date":
    case "rent_commencement_date":
    case "expiry_date": {
      if (field === "expiry_date") {
        const effective = effectiveExpiryDate(extracted);
        const f = formatIsoDate(effective);
        const lines: string[] = [f ? f : "—"];
        if (isExpiryOverriddenByServedNotice(extracted)) {
          const contractual = formatIsoDate(extracted.expiry_date);
          if (contractual) {
            lines.push(`Contractual expiry in lease: ${contractual}`);
          }
          lines.push("Updated from break notice served date plus notice period.");
        }
        return lines;
      }
      const v =
        field === "term_commencement_date"
          ? extracted.term_commencement_date
          : extracted.rent_commencement_date;
      const f = formatIsoDate(v);
      return [f ? f : "—"];
    }
    case "break_dates": {
      const arr = jsonStringArray(extracted.break_dates);
      const entryMap = parseBreakClauseEntryMap(extracted.break_clause_status);
      const lines = arr
        .map((d) => {
          const fd = formatIsoDate(d);
          if (!fd) {
            return null;
          }
          const entry = entryMap[d] ?? { status: "available" as const, served: null };
          const st = entry.status;
          let line = `${fd} (${BREAK_CLAUSE_STATUS_LABEL[st]})`;
          if (st === "served" && entry.served) {
            const servedLabel = formatIsoDate(entry.served.notice_served_date) ?? entry.served.notice_served_date;
            const end = tenancyEndFromServedNotice(
              entry.served.notice_served_date,
              extracted.notice_period_days,
            );
            const endLabel = end ? formatIsoDate(end) : null;
            line += ` — notice served ${servedLabel}`;
            if (endLabel) {
              line += `, tenancy ends ${endLabel}`;
            }
          }
          return line;
        })
        .filter((x): x is string => Boolean(x));
      return lines.length ? lines : ["—"];
    }
    case "notice_period_days": {
      const n = extracted.notice_period_days;
      if (n == null) {
        return ["—"];
      }
      return [`${n} day${n === 1 ? "" : "s"}`];
    }
    case "rent_review_dates": {
      const arr = jsonStringArray(extracted.rent_review_dates);
      const lines = arr.map((d) => formatIsoDate(d)).filter((x): x is string => Boolean(x));
      return lines.length ? lines : ["—"];
    }
    case "repairing_obligation": {
      const t = extracted.repairing_obligation?.trim();
      return [t && t.length > 0 ? t : "—"];
    }
    case "service_charge_responsibility": {
      const t = extracted.service_charge_responsibility?.trim();
      return [t && t.length > 0 ? t : "—"];
    }
    case "conditional_break_clause": {
      const t = extracted.conditional_break_clause?.trim();
      return [t && t.length > 0 ? t : "—"];
    }
    case "reinstatement_required":
      return [
        extracted.reinstatement_required == null
          ? "—"
          : extracted.reinstatement_required
            ? "Yes — reinstatement required"
            : "No",
      ];
    case "vacant_possession_required":
      return [
        extracted.vacant_possession_required == null
          ? "—"
          : extracted.vacant_possession_required
            ? "Yes — vacant possession required"
            : "No",
      ];
    default:
      return ["—"];
  }
}

export function formatOperativeFieldPlain(field: string, extracted: Tables<"extracted_data">): string {
  const lines = formatOperativeFieldLines(field, extracted);
  if (lines.length === 1) {
    return lines[0] ?? "—";
  }
  return lines.join("; ");
}
