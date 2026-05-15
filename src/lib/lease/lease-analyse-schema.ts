import { z } from "zod";

import { parseNoticePeriodSpec } from "@/lib/lease/jurisdiction/parse-notice-period-spec";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const dateOrNull = z.union([z.string().regex(ISO_DATE, "Expected YYYY-MM-DD"), z.null()]);

const dateArray = z.array(z.string().regex(ISO_DATE, "Expected YYYY-MM-DD"));

/**
 * Models sometimes echo structured types under `source_snippets` (e.g. `rent_review_dates` as a date array).
 * The app only stores string snippets; coerce everything to a single display string.
 */
export function coerceSourceSnippetsInput(raw: unknown): Record<string, string> {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof k !== "string" || k.trim() === "") {
      continue;
    }
    let text: string;
    if (typeof v === "string") {
      text = v;
    } else if (Array.isArray(v)) {
      text = v
        .map((item) => {
          if (typeof item === "string") {
            return item;
          }
          if (item === null || item === undefined) {
            return "";
          }
          return JSON.stringify(item);
        })
        .filter(Boolean)
        .join("\n");
    } else if (v === null || v === undefined) {
      continue;
    } else if (typeof v === "number" || typeof v === "boolean") {
      text = String(v);
    } else if (typeof v === "object") {
      text = JSON.stringify(v);
    } else {
      text = String(v);
    }
    const trimmed = text.trim();
    if (trimmed) {
      out[k] = trimmed.length <= 20_000 ? trimmed : `${trimmed.slice(0, 20_000)}…`;
    }
  }
  return out;
}

const fieldExtractionMetaEntrySchema = z
  .object({
    confidence: z.union([z.number().min(0).max(1), z.null()]).optional(),
    rationale: z.union([z.string(), z.null()]).optional(),
    clause_reference: z.union([z.string(), z.null()]).optional(),
  })
  .strip();

export type FieldExtractionMetaEntryOutput = z.infer<typeof fieldExtractionMetaEntrySchema>;

function firstNonEmptyString(...vals: readonly unknown[]): string | undefined {
  for (const x of vals) {
    if (typeof x !== "string") {
      continue;
    }
    const t = x.trim();
    if (t.length > 0) {
      return t;
    }
  }
  return undefined;
}

/**
 * Maps common model aliases onto `clause_reference` / `rationale` before Zod parse
 * (models often emit camelCase or alternate names).
 */
function normalizeFieldExtractionMetaEntryShape(v: Record<string, unknown>): Record<string, unknown> {
  const clause = firstNonEmptyString(
    v.clause_reference,
    v.clauseReference,
    v.clause,
    v.clause_ref,
    v.schedule_reference,
    v.cite,
  );
  const rationale = firstNonEmptyString(
    v.rationale,
    v.reasoning,
    v.notes,
    v.explanation,
    v.summary,
    v.evidence,
  );
  const next: Record<string, unknown> = { ...v };
  if (clause !== undefined) {
    next.clause_reference = clause;
  }
  if (rationale !== undefined) {
    next.rationale = rationale;
  }
  return next;
}

/**
 * Per-field explainability from the model (clause cite, rationale, local confidence).
 */
export function coerceFieldExtractionMetaInput(raw: unknown): Record<string, FieldExtractionMetaEntryOutput> {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const out: Record<string, FieldExtractionMetaEntryOutput> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof k !== "string" || k.trim() === "") {
      continue;
    }
    if (v == null || typeof v !== "object" || Array.isArray(v)) {
      continue;
    }
    const normalized = normalizeFieldExtractionMetaEntryShape(v as Record<string, unknown>);
    const parsed = fieldExtractionMetaEntrySchema.safeParse(normalized);
    if (parsed.success) {
      out[k] = parsed.data;
    }
  }
  return out;
}

function coerceConfidence01(v: unknown): number | null {
  if (v === null || v === undefined) {
    return null;
  }
  if (typeof v === "number" && Number.isFinite(v)) {
    return Math.min(1, Math.max(0, v));
  }
  return null;
}

const dateFieldConfidenceObjectSchema = z
  .object({
    term_commencement_date: z.union([z.number().min(0).max(1), z.null()]),
    rent_commencement_date: z.union([z.number().min(0).max(1), z.null()]),
    rent_review_dates: z.union([z.number().min(0).max(1), z.null()]),
  })
  .strict();

export function coerceDateFieldConfidenceInput(raw: unknown): z.infer<typeof dateFieldConfidenceObjectSchema> {
  const base = {
    term_commencement_date: null as number | null,
    rent_commencement_date: null as number | null,
    rent_review_dates: null as number | null,
  };
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return base;
  }
  const o = raw as Record<string, unknown>;
  return {
    term_commencement_date: coerceConfidence01(o.term_commencement_date),
    rent_commencement_date: coerceConfidence01(o.rent_commencement_date),
    rent_review_dates: coerceConfidence01(o.rent_review_dates),
  };
}

const dateAmbiguityEntrySchema = z
  .object({
    code: z.string(),
    detail: z.union([z.string(), z.null()]),
  })
  .strip();

export function coerceDateAmbiguitiesInput(raw: unknown): z.infer<typeof dateAmbiguityEntrySchema>[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: z.infer<typeof dateAmbiguityEntrySchema>[] = [];
  for (const item of raw) {
    if (item == null || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }
    const o = item as Record<string, unknown>;
    const code = typeof o.code === "string" ? o.code.trim() : "";
    if (!code) {
      continue;
    }
    const detail =
      o.detail === null || o.detail === undefined
        ? null
        : typeof o.detail === "string"
          ? o.detail.trim() || null
          : null;
    out.push({ code, detail });
  }
  return out;
}

const countryCodeOrNull = z.preprocess((raw) => {
  if (raw === null || raw === undefined || raw === "") {
    return null;
  }
  if (typeof raw !== "string") {
    return raw;
  }
  const t = raw.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(t) ? t : null;
}, z.union([z.string().length(2), z.null()]));

const currencyCodeOrNull = z.preprocess((raw) => {
  if (raw === null || raw === undefined || raw === "") {
    return null;
  }
  if (typeof raw !== "string") {
    return raw;
  }
  const t = raw.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(t) ? t : null;
}, z.union([z.string().length(3), z.null()]));

const noticePeriodSpecSchema = z.preprocess(
  (raw) => parseNoticePeriodSpec(raw),
  z
    .object({
      value: z.number().int().min(1).max(3650),
      unit: z.enum(["calendar_days", "business_days", "months", "years"]),
      day_basis: z.enum(["calendar", "business"]).nullable().optional(),
      anchor: z.enum(["before_break_date", "before_expiry", "unspecified"]).nullable().optional(),
      source_text: z.union([z.string().max(500), z.null()]).optional(),
    })
    .nullable(),
);

/**
 * Strict schema for OpenAI lease structured extraction.
 * All keys must be present in the model response (strict object).
 */
export const leaseAnalyseOutputSchema = z
  .object({
    term_commencement_date: dateOrNull,
    rent_commencement_date: dateOrNull,
    expiry_date: dateOrNull,
    break_dates: dateArray,
    notice_period_days: z.union([z.number().int().min(0).max(3650), z.null()]),
    notice_period_spec: noticePeriodSpecSchema,
    governing_law: z.union([z.string().max(500), z.null()]),
    premises_country: countryCodeOrNull,
    rent_currency: currencyCodeOrNull,
    rent_review_dates: dateArray,
    repairing_obligation: z.union([z.string(), z.null()]),
    service_charge_responsibility: z.union([z.string(), z.null()]),
    reinstatement_required: z.union([z.boolean(), z.null()]),
    vacant_possession_required: z.union([z.boolean(), z.null()]),
    conditional_break_clause: z.union([z.string(), z.null()]),
    ambiguous_language: z.boolean(),
    manual_review_recommended: z.boolean(),
    confidence_score: z.union([z.number().min(0).max(1), z.null()]),
    date_field_confidence: z.preprocess(
      coerceDateFieldConfidenceInput,
      dateFieldConfidenceObjectSchema,
    ),
    date_ambiguities: z.preprocess(coerceDateAmbiguitiesInput, z.array(dateAmbiguityEntrySchema)),
    source_snippets: z.preprocess(coerceSourceSnippetsInput, z.record(z.string(), z.string())),
    field_extraction_meta: z.preprocess(
      coerceFieldExtractionMetaInput,
      z.record(z.string(), fieldExtractionMetaEntrySchema),
    ),
  })
  .strict();

export type LeaseAnalyseOutput = z.infer<typeof leaseAnalyseOutputSchema>;

const LOW_DATE_FIELD_CONFIDENCE = 0.55;

/**
 * Enforces conservative review flags from ambiguous wording, date ambiguity records,
 * and low per-date confidence scores.
 */
export function finalizeLeaseAnalyseOutput(data: LeaseAnalyseOutput): LeaseAnalyseOutput {
  const dfc = data.date_field_confidence;
  const lowPerDate =
    (dfc.term_commencement_date != null && dfc.term_commencement_date < LOW_DATE_FIELD_CONFIDENCE) ||
    (dfc.rent_commencement_date != null && dfc.rent_commencement_date < LOW_DATE_FIELD_CONFIDENCE) ||
    (dfc.rent_review_dates != null && dfc.rent_review_dates < LOW_DATE_FIELD_CONFIDENCE);
  const dateAmb = data.date_ambiguities.length > 0;
  return {
    ...data,
    manual_review_recommended:
      data.manual_review_recommended || data.ambiguous_language || dateAmb || lowPerDate,
  };
}

export function parseLeaseAnalyseJson(raw: unknown): LeaseAnalyseOutput {
  return leaseAnalyseOutputSchema.parse(raw);
}

export function safeParseLeaseAnalyseJson(raw: unknown) {
  return leaseAnalyseOutputSchema.safeParse(raw);
}
