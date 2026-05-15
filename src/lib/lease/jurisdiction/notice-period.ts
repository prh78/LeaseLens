import { parseIsoDateUtc, utcDateOnlyString } from "@/lib/alerts/date-helpers";
import type { NoticePeriodSpec } from "@/lib/lease/jurisdiction/types";

export type NoticePeriodConversion = Readonly<{
  /** Calendar days used by dashboard / break math when conversion is confident. */
  days: number | null;
  /** False when months/business days need human confirmation. */
  confident: boolean;
  warning?: string;
}>;

/**
 * Converts extracted notice_period_spec to calendar days for existing break/expiry math.
 * v1 sketch: months ≈ 30.44× value (document in UI); business days ≈ calendar days with flag.
 */
export function noticePeriodToCalendarDays(spec: NoticePeriodSpec | null | undefined): NoticePeriodConversion {
  if (!spec || !Number.isFinite(spec.value) || spec.value < 1) {
    return { days: null, confident: false, warning: "No notice period extracted." };
  }

  const value = Math.floor(spec.value);

  switch (spec.unit) {
    case "calendar_days":
      return { days: value, confident: true };
    case "business_days":
      return {
        days: value,
        confident: false,
        warning: "Business-day notice stored as day count; confirm against lease and local holidays.",
      };
    case "months":
      return {
        days: Math.round(value * 30.4375),
        confident: false,
        warning: `Notice is ${value} month(s) in the lease; dashboard uses an approximate day count. Confirm critical dates manually.`,
      };
    case "years":
      return {
        days: Math.round(value * 365.25),
        confident: false,
        warning: `Notice is ${value} year(s) in the lease; dashboard uses an approximate day count.`,
      };
    default:
      return { days: null, confident: false };
  }
}

/** Effective days: prefer normalised column when present, else convert spec. */
export function effectiveNoticePeriodDays(
  noticePeriodDays: number | null,
  spec: NoticePeriodSpec | null | undefined,
): NoticePeriodConversion {
  if (noticePeriodDays != null && noticePeriodDays >= 1) {
    return { days: Math.floor(noticePeriodDays), confident: true };
  }
  return noticePeriodToCalendarDays(spec);
}

/** Calendar day count for break/expiry math (null when notice cannot be resolved). */
export function resolvedNoticePeriodDayCount(
  noticePeriodDays: number | null,
  spec: NoticePeriodSpec | null | undefined,
): number | null {
  return effectiveNoticePeriodDays(noticePeriodDays, spec).days;
}

/** Add whole calendar months to an ISO date (UTC components). Sketch for month-based notice. */
export function addCalendarMonths(iso: string, months: number): string | null {
  const d = parseIsoDateUtc(iso);
  if (!d || months < 1) {
    return null;
  }
  d.setUTCMonth(d.getUTCMonth() + months);
  return utcDateOnlyString(d);
}
