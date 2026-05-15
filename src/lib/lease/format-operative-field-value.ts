import { jsonStringArray } from "@/lib/lease/lease-detail";
import {
  BREAK_CLAUSE_STATUS_LABEL,
  effectiveExpiryDate,
  isExpiryOverriddenByServedNotice,
  parseBreakClauseEntryMap,
  tenancyEndFromServedNotice,
} from "@/lib/lease/break-clause-status";
import { DEFAULT_DISPLAY_LOCALE, formatAppDate } from "@/lib/lease/format-app-date";
import { formatNoticePeriodLines } from "@/lib/lease/jurisdiction/format-notice-period-lines";
import type { Tables } from "@/lib/supabase/database.types";

export type FormatOperativeOptions = Readonly<{
  locale?: string;
  leaseJurisdiction?: string;
}>;

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

export function formatOperativeFieldLines(
  field: string,
  extracted: Tables<"extracted_data">,
  options: FormatOperativeOptions = {},
): string[] {
  const locale = options.locale ?? DEFAULT_DISPLAY_LOCALE;

  switch (field) {
    case "term_commencement_date":
    case "rent_commencement_date":
    case "expiry_date": {
      if (field === "expiry_date") {
        const effective = effectiveExpiryDate(extracted);
        const f = formatAppDate(effective, locale);
        const lines: string[] = [f ? f : "—"];
        if (isExpiryOverriddenByServedNotice(extracted)) {
          const contractual = formatAppDate(extracted.expiry_date, locale);
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
      const f = formatAppDate(v, locale);
      return [f ? f : "—"];
    }
    case "break_dates": {
      const arr = jsonStringArray(extracted.break_dates);
      const entryMap = parseBreakClauseEntryMap(extracted.break_clause_status);
      const lines = arr
        .map((d) => {
          const fd = formatAppDate(d, locale);
          if (!fd) {
            return null;
          }
          const entry = entryMap[d] ?? { status: "available" as const, served: null };
          const st = entry.status;
          let line = `${fd} (${BREAK_CLAUSE_STATUS_LABEL[st]})`;
          if (st === "served" && entry.served) {
            const servedLabel =
              formatAppDate(entry.served.notice_served_date, locale) ?? entry.served.notice_served_date;
            const end = tenancyEndFromServedNotice(
              entry.served.notice_served_date,
              extracted.notice_period_days,
            );
            const endLabel = end ? formatAppDate(end, locale) : null;
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
    case "notice_period_days":
      return formatNoticePeriodLines(extracted, locale);
    case "rent_review_dates": {
      const arr = jsonStringArray(extracted.rent_review_dates);
      const lines = arr.map((d) => formatAppDate(d, locale)).filter((x): x is string => Boolean(x));
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

export function formatOperativeFieldPlain(
  field: string,
  extracted: Tables<"extracted_data">,
  options: FormatOperativeOptions = {},
): string {
  const lines = formatOperativeFieldLines(field, extracted, options);
  if (lines.length === 1) {
    return lines[0] ?? "—";
  }
  return lines.join("; ");
}
