import { formatIsoDate, jsonStringArray } from "@/lib/lease/lease-detail";
import type { Tables } from "@/lib/supabase/database.types";

/** Field keys rendered under "Current operative terms" (same groupings as the lease UI). */
export const OPERATIVE_TERMS_CRITICAL_FIELDS = [
  "commencement_date",
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
    case "commencement_date":
    case "expiry_date": {
      const v = field === "commencement_date" ? extracted.commencement_date : extracted.expiry_date;
      const f = formatIsoDate(v);
      return [f ? f : "—"];
    }
    case "break_dates": {
      const arr = jsonStringArray(extracted.break_dates);
      const lines = arr.map((d) => formatIsoDate(d)).filter((x): x is string => Boolean(x));
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
