import { parseIsoDateUtc } from "@/lib/alerts/date-helpers";
import { jsonSnippetMap, jsonStringArray } from "@/lib/lease/lease-detail";
import { snippetEvidenceForField } from "@/lib/lease/lease-detail-audit";
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
  source_snippets?: Json | null;
}>;

type KeyDateField = "term_commencement_date" | "rent_commencement_date" | "expiry_date";

const KEY_DATE_FIELDS: readonly { field: KeyDateField; label: string }[] = [
  { field: "term_commencement_date", label: "Term commencement date" },
  { field: "rent_commencement_date", label: "Rent commencement date" },
  { field: "expiry_date", label: "Expiry date" },
];

const MONTH_NAMES = [
  ["jan", "january"],
  ["feb", "february"],
  ["mar", "march"],
  ["apr", "april"],
  ["may"],
  ["jun", "june"],
  ["jul", "july"],
  ["aug", "august"],
  ["sep", "sept", "september"],
  ["oct", "october"],
  ["nov", "november"],
  ["dec", "december"],
] as const;

function compactNumericDateVariants(iso: string): string[] {
  const d = parseIsoDateUtc(iso);
  if (!d) {
    return [];
  }
  const y = String(d.getUTCFullYear());
  const m = String(d.getUTCMonth() + 1);
  const mm = m.padStart(2, "0");
  const day = String(d.getUTCDate());
  const dd = day.padStart(2, "0");
  return [
    `${y}-${mm}-${dd}`,
    `${dd}/${mm}/${y}`,
    `${day}/${m}/${y}`,
    `${dd}.${mm}.${y}`,
    `${day}.${m}.${y}`,
    `${dd}-${mm}-${y}`,
    `${day}-${m}-${y}`,
  ];
}

function sourceTextSupportsIsoDate(sourceText: string, iso: string): boolean {
  const d = parseIsoDateUtc(iso);
  if (!d) {
    return false;
  }
  const text = sourceText.toLowerCase();
  if (compactNumericDateVariants(iso).some((variant) => text.includes(variant.toLowerCase()))) {
    return true;
  }
  const y = String(d.getUTCFullYear());
  const day = String(d.getUTCDate());
  const ordinalDay = `${day}${day.endsWith("1") && day !== "11" ? "st" : day.endsWith("2") && day !== "12" ? "nd" : day.endsWith("3") && day !== "13" ? "rd" : "th"}`;
  const monthNames = MONTH_NAMES[d.getUTCMonth()] ?? [];
  return text.includes(y) && monthNames.some((month) => text.includes(month)) && (
    new RegExp(`\\b${day}\\b`).test(text) || new RegExp(`\\b${ordinalDay}\\b`).test(text)
  );
}

function evidenceTextForDateField(
  field: KeyDateField,
  input: LeaseDateValidationInput,
  meta: Record<string, FieldExtractionMetaEntry>,
): string {
  const snippets = jsonSnippetMap(input.source_snippets ?? null);
  return [
    snippetEvidenceForField(field, snippets),
    meta[field]?.clause_reference,
    meta[field]?.rationale,
  ]
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .join("\n");
}

function unsupportedKeyDateWarnings(input: LeaseDateValidationInput): LeaseDateValidationWarning[] {
  const meta = parseFieldExtractionMeta(input.field_extraction_meta ?? null);
  const warnings: LeaseDateValidationWarning[] = [];
  for (const { field, label } of KEY_DATE_FIELDS) {
    const iso = input[field];
    if (!validIso(iso)) {
      continue;
    }
    const evidenceText = evidenceTextForDateField(field, input, meta);
    if (!evidenceText || !sourceTextSupportsIsoDate(evidenceText, iso)) {
      warnings.push({
        code: `${field}_not_supported_by_source_excerpt`,
        message: `${label} (${iso}) is not supported by the stored source excerpt/rationale. This often happens where dates are handwritten or OCR is uncertain; verify against the signed lease.`,
      });
    }
  }
  return warnings;
}

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
  warnings.push(...unsupportedKeyDateWarnings(input));

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
  const initialWarnings = computeLeaseDateValidationWarnings({
    term_commencement_date: data.term_commencement_date,
    rent_commencement_date: data.rent_commencement_date,
    expiry_date: data.expiry_date,
    rent_review_dates: data.rent_review_dates as unknown as Json,
    field_extraction_meta: data.field_extraction_meta as unknown as Json,
    source_snippets: data.source_snippets as unknown as Json,
  });
  const unsupportedKeyDateFields = new Set<KeyDateField>(
    initialWarnings
      .map((warning) => KEY_DATE_FIELDS.find(({ field }) => warning.code === `${field}_not_supported_by_source_excerpt`)?.field)
      .filter((field): field is KeyDateField => Boolean(field)),
  );
  const guardedData: LeaseAnalyseOutput = {
    ...data,
    term_commencement_date: unsupportedKeyDateFields.has("term_commencement_date")
      ? null
      : data.term_commencement_date,
    rent_commencement_date: unsupportedKeyDateFields.has("rent_commencement_date")
      ? null
      : data.rent_commencement_date,
    expiry_date: unsupportedKeyDateFields.has("expiry_date") ? null : data.expiry_date,
  };
  const warnings = computeLeaseDateValidationWarnings({
    term_commencement_date: guardedData.term_commencement_date,
    rent_commencement_date: guardedData.rent_commencement_date,
    expiry_date: guardedData.expiry_date,
    rent_review_dates: guardedData.rent_review_dates as unknown as Json,
    field_extraction_meta: guardedData.field_extraction_meta as unknown as Json,
    source_snippets: guardedData.source_snippets as unknown as Json,
  });
  const combinedWarnings = [
    ...initialWarnings,
    ...warnings.filter((warning) => !initialWarnings.some((w) => w.code === warning.code && w.message === warning.message)),
  ];
  const requiresManualReview = combinedWarnings.length > 0;
  return {
    data: {
      ...guardedData,
      manual_review_recommended: data.manual_review_recommended || requiresManualReview,
    },
    warnings: combinedWarnings,
    requiresManualReview,
  };
}

/** Convenience for lease UI — always reflects current validation rules. */
export function leaseDateValidationWarningsFromExtractedRow(
  row: Pick<
    Tables<"extracted_data">,
    | "term_commencement_date"
    | "rent_commencement_date"
    | "expiry_date"
    | "rent_review_dates"
    | "field_extraction_meta"
    | "source_snippets"
  >,
): LeaseDateValidationWarning[] {
  return computeLeaseDateValidationWarnings({
    term_commencement_date: row.term_commencement_date,
    rent_commencement_date: row.rent_commencement_date,
    expiry_date: row.expiry_date,
    rent_review_dates: row.rent_review_dates,
    field_extraction_meta: row.field_extraction_meta ?? null,
    source_snippets: row.source_snippets ?? null,
  });
}
