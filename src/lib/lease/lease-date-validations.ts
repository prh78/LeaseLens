import { parseIsoDateUtc } from "@/lib/alerts/date-helpers";
import { jsonStringArray } from "@/lib/lease/lease-detail";
import type { FieldExtractionMetaEntry } from "@/lib/lease/field-extraction-meta";
import { parseFieldExtractionMeta } from "@/lib/lease/field-extraction-meta";
import type { Json, Tables } from "@/lib/supabase/database.types";
import type { LeaseAnalyseOutput } from "@/lib/lease/lease-analyse-schema";

export type LeaseDateValidationWarning = Readonly<{
  code: string;
  message: string;
}>;

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function validIso(iso: string | null | undefined): iso is string {
  return typeof iso === "string" && ISO.test(iso) && parseIsoDateUtc(iso) !== null;
}

function compareIso(a: string, b: string): number {
  return a.localeCompare(b);
}

/** Whole + fractional calendar years between two ISO dates (UTC calendar). */
function approximateYearsBetween(termStartIso: string, expiryIso: string): number | null {
  const d0 = parseIsoDateUtc(termStartIso);
  const d1 = parseIsoDateUtc(expiryIso);
  if (!d0 || !d1) {
    return null;
  }
  const ms = d1.getTime() - d0.getTime();
  if (ms <= 0) {
    return null;
  }
  return ms / (86_400_000 * 365.25);
}

/**
 * Best-effort stated term length in years from model rationales (e.g. "15 years from the Term Commencement Date").
 */
function statedTermYearsFromMeta(meta: Record<string, FieldExtractionMetaEntry>): number | null {
  const text = ["term_commencement_date", "expiry_date"]
    .map((k) => meta[k]?.rationale?.trim() ?? "")
    .filter(Boolean)
    .join("\n");
  if (!text) {
    return null;
  }
  const re = /\b(\d{1,2})\s*(?:calendar\s+)?years?\b/gi;
  for (const m of text.matchAll(re)) {
    const n = Number(m[1]);
    if (Number.isInteger(n) && n >= 1 && n <= 125) {
      return n;
    }
  }
  return null;
}

export type LeaseDateValidationInput = Readonly<{
  term_commencement_date: string | null;
  rent_commencement_date: string | null;
  expiry_date: string | null;
  rent_review_dates: Json;
  field_extraction_meta?: Json | null;
}>;

/**
 * Deterministic checks on extracted lease dates (no LLM). Used on analyse and lease UI.
 */
export function computeLeaseDateValidationWarnings(input: LeaseDateValidationInput): LeaseDateValidationWarning[] {
  const warnings: LeaseDateValidationWarning[] = [];
  const term = input.term_commencement_date;
  const rent = input.rent_commencement_date;
  const expiry = input.expiry_date;
  const reviews = jsonStringArray(input.rent_review_dates).filter(validIso);
  const meta = parseFieldExtractionMeta(input.field_extraction_meta ?? null);

  if (validIso(term) && validIso(rent) && compareIso(term, rent) > 0) {
    warnings.push({
      code: "term_commencement_after_rent_commencement",
      message:
        "Term commencement is after rent commencement. Ordinarily the contractual term begins on or before rent starts — verify dates and definitions.",
    });
  }

  if (validIso(rent)) {
    const equalsRent: string[] = [];
    const beforeRent: string[] = [];
    for (const r of reviews) {
      if (r === rent) {
        equalsRent.push(r);
      }
      if (compareIso(r, rent) < 0) {
        beforeRent.push(r);
      }
    }
    if (equalsRent.length > 0) {
      warnings.push({
        code: "rent_review_equals_rent_commencement",
        message: `Rent review date(s) match rent commencement (${rent}): ${[...new Set(equalsRent)].join(", ")}. Rent reviews should not duplicate the first rent payment date unless the lease explicitly says so.`,
      });
    }
    if (beforeRent.length > 0) {
      warnings.push({
        code: "rent_review_before_rent_commencement",
        message: `Rent review date(s) before rent commencement (${rent}): ${[...new Set(beforeRent)].sort().join(", ")}.`,
      });
    }
  }

  if (validIso(term) && validIso(expiry)) {
    const cmp = compareIso(expiry, term);
    if (cmp <= 0) {
      warnings.push({
        code: "expiry_not_after_term_commencement",
        message: "Expiry is on or before term commencement. The lease term should end after it begins.",
      });
    } else {
      const statedYears = statedTermYearsFromMeta(meta);
      const computedYears = approximateYearsBetween(term, expiry);
      if (statedYears != null && computedYears != null) {
        if (Math.abs(computedYears - statedYears) > 0.75) {
          warnings.push({
            code: "expiry_term_length_mismatch",
            message: `Stated term of about ${statedYears} year(s) in extraction notes does not match the calendar span from term commencement to expiry (~${computedYears.toFixed(1)} years). Check commencement, expiry, and any rent-free or part-year wording.`,
          });
        }
      }
    }
  }

  return warnings;
}

export function parseDateValidationWarnings(raw: Json | null | undefined): LeaseDateValidationWarning[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: LeaseDateValidationWarning[] = [];
  for (const item of raw) {
    if (item == null || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }
    const o = item as Record<string, unknown>;
    const code = typeof o.code === "string" ? o.code.trim() : "";
    const message = typeof o.message === "string" ? o.message.trim() : "";
    if (code && message) {
      out.push({ code, message });
    }
  }
  return out;
}

export type ApplyLeaseDateValidationResult = Readonly<{
  data: LeaseAnalyseOutput;
  warnings: readonly LeaseDateValidationWarning[];
  requiresManualReview: boolean;
}>;

/**
 * Applies deterministic date rules: extends `manual_review_recommended` when any rule fires.
 */
export function applyLeaseDateValidationRules(data: LeaseAnalyseOutput): ApplyLeaseDateValidationResult {
  const warnings = computeLeaseDateValidationWarnings({
    term_commencement_date: data.term_commencement_date,
    rent_commencement_date: data.rent_commencement_date,
    expiry_date: data.expiry_date,
    rent_review_dates: data.rent_review_dates as unknown as Json,
    field_extraction_meta: data.field_extraction_meta as unknown as Json,
  });
  const requiresManualReview = warnings.length > 0;
  return {
    data: {
      ...data,
      manual_review_recommended: data.manual_review_recommended || requiresManualReview,
    },
    warnings,
    requiresManualReview,
  };
}

/** Convenience for lease UI — always reflects current validation rules. */
export function leaseDateValidationWarningsFromExtractedRow(
  row: Pick<
    Tables<"extracted_data">,
    "term_commencement_date" | "rent_commencement_date" | "expiry_date" | "rent_review_dates" | "field_extraction_meta"
  >,
): LeaseDateValidationWarning[] {
  return computeLeaseDateValidationWarnings({
    term_commencement_date: row.term_commencement_date,
    rent_commencement_date: row.rent_commencement_date,
    expiry_date: row.expiry_date,
    rent_review_dates: row.rent_review_dates,
    field_extraction_meta: row.field_extraction_meta ?? null,
  });
}
