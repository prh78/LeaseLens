import { z } from "zod";

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

/**
 * Strict schema for OpenAI lease structured extraction.
 * All keys must be present in the model response (strict object).
 */
export const leaseAnalyseOutputSchema = z
  .object({
    commencement_date: dateOrNull,
    expiry_date: dateOrNull,
    break_dates: dateArray,
    notice_period_days: z.union([z.number().int().min(0).max(3650), z.null()]),
    rent_review_dates: dateArray,
    repairing_obligation: z.union([z.string(), z.null()]),
    service_charge_responsibility: z.union([z.string(), z.null()]),
    reinstatement_required: z.union([z.boolean(), z.null()]),
    vacant_possession_required: z.union([z.boolean(), z.null()]),
    conditional_break_clause: z.union([z.string(), z.null()]),
    ambiguous_language: z.boolean(),
    manual_review_recommended: z.boolean(),
    confidence_score: z.union([z.number().min(0).max(1), z.null()]),
    source_snippets: z.preprocess(coerceSourceSnippetsInput, z.record(z.string(), z.string())),
    field_extraction_meta: z.preprocess(
      coerceFieldExtractionMetaInput,
      z.record(z.string(), fieldExtractionMetaEntrySchema),
    ),
  })
  .strict();

export type LeaseAnalyseOutput = z.infer<typeof leaseAnalyseOutputSchema>;

export function parseLeaseAnalyseJson(raw: unknown): LeaseAnalyseOutput {
  return leaseAnalyseOutputSchema.parse(raw);
}

export function safeParseLeaseAnalyseJson(raw: unknown) {
  return leaseAnalyseOutputSchema.safeParse(raw);
}
