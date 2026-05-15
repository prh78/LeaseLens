import { parseIsoDateUtc, utcDateOnlyString } from "@/lib/alerts/date-helpers";

/** Supported business-day locales (mapped from premises country or jurisdiction). */
export type BusinessDayLocale = "GB" | "US" | "EU" | "DEFAULT";

const ISO = /^[A-Z]{2}$/;

/**
 * Maps ISO 3166-1 alpha-2 premises country (or jurisdiction fallback) to a business-day calendar.
 */
export function businessDayLocaleFromCountry(
  premisesCountry: string | null | undefined,
  leaseJurisdiction?: string | null,
): BusinessDayLocale {
  const c = premisesCountry?.trim().toUpperCase();
  if (c && ISO.test(c)) {
    if (c === "GB" || c === "UK" || c === "IE") {
      return "GB";
    }
    if (c === "US") {
      return "US";
    }
    const euLike = new Set([
      "AT",
      "BE",
      "BG",
      "HR",
      "CY",
      "CZ",
      "DK",
      "EE",
      "FI",
      "FR",
      "DE",
      "GR",
      "HU",
      "IT",
      "LV",
      "LT",
      "LU",
      "MT",
      "NL",
      "PL",
      "PT",
      "RO",
      "SK",
      "SI",
      "ES",
      "SE",
      "NO",
      "CH",
      "IS",
      "LI",
    ]);
    if (euLike.has(c)) {
      return "EU";
    }
  }
  if (leaseJurisdiction === "uk") {
    return "GB";
  }
  if (leaseJurisdiction === "us") {
    return "US";
  }
  if (leaseJurisdiction === "eu") {
    return "EU";
  }
  return "DEFAULT";
}

function isWeekendUtc(d: Date): boolean {
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}

/** Fixed MM-DD public holidays (US federal, observed on calendar day for v1 sketch). */
const US_FIXED_HOLIDAYS = new Set([
  "01-01",
  "06-19",
  "07-04",
  "11-11",
  "12-25",
]);

function isUsFederalHolidayUtc(d: Date): boolean {
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return US_FIXED_HOLIDAYS.has(`${m}-${day}`);
}

export function isBusinessDayUtc(d: Date, locale: BusinessDayLocale): boolean {
  if (isWeekendUtc(d)) {
    return false;
  }
  if (locale === "US" && isUsFederalHolidayUtc(d)) {
    return false;
  }
  return true;
}

function shiftBusinessDays(iso: string, count: number, locale: BusinessDayLocale, direction: 1 | -1): string | null {
  if (count < 1) {
    return null;
  }
  const start = parseIsoDateUtc(iso);
  if (!start) {
    return null;
  }
  const d = new Date(start.getTime());
  let remaining = count;
  while (remaining > 0) {
    d.setUTCDate(d.getUTCDate() + direction);
    if (isBusinessDayUtc(d, locale)) {
      remaining -= 1;
    }
  }
  return utcDateOnlyString(d);
}

export function addBusinessDays(
  iso: string,
  count: number,
  locale: BusinessDayLocale,
): string | null {
  return shiftBusinessDays(iso, count, locale, 1);
}

export function subtractBusinessDays(
  iso: string,
  count: number,
  locale: BusinessDayLocale,
): string | null {
  return shiftBusinessDays(iso, count, locale, -1);
}
