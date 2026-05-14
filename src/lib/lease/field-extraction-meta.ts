import type { Json } from "@/lib/supabase/database.types";

/** Per-field explainability from structured extraction (stored in `extracted_data.field_extraction_meta`). */
export type FieldExtractionMetaEntry = Readonly<{
  confidence?: number | null;
  rationale?: string | null;
  clause_reference?: string | null;
}>;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function firstNonEmptyStringFromRecord(r: Record<string, unknown>, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const x = r[key];
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

export function parseFieldExtractionMeta(raw: Json | null | undefined): Record<string, FieldExtractionMetaEntry> {
  if (raw == null || !isRecord(raw)) {
    return {};
  }
  const out: Record<string, FieldExtractionMetaEntry> = {};
  for (const [field, v] of Object.entries(raw)) {
    if (!isRecord(v)) {
      continue;
    }
    const r = v as Record<string, unknown>;
    const confidence =
      typeof r.confidence === "number" && Number.isFinite(r.confidence)
        ? Math.min(1, Math.max(0, r.confidence))
        : r.confidence === null
          ? null
          : undefined;

    const rationaleStr = firstNonEmptyStringFromRecord(r, [
      "rationale",
      "reasoning",
      "notes",
      "explanation",
      "summary",
      "evidence",
    ]);
    const rationale =
      rationaleStr !== undefined
        ? rationaleStr
        : typeof r.rationale === "string"
          ? r.rationale
          : typeof r.reasoning === "string"
            ? r.reasoning
            : r.rationale === null
              ? null
              : r.reasoning === null
                ? null
                : undefined;

    const clauseStr = firstNonEmptyStringFromRecord(r, [
      "clause_reference",
      "clauseReference",
      "clause",
      "clause_ref",
      "schedule_reference",
      "cite",
    ]);
    const clause_reference =
      clauseStr !== undefined
        ? clauseStr
        : typeof r.clause_reference === "string"
          ? r.clause_reference
          : typeof r.clauseReference === "string"
            ? r.clauseReference
            : r.clause_reference === null
              ? null
              : r.clauseReference === null
                ? null
                : undefined;

    if (confidence !== undefined || rationale !== undefined || clause_reference !== undefined) {
      out[field] = { confidence, rationale, clause_reference };
    }
  }
  return out;
}

/** Effective confidence for a field: per-field meta, else global model score. */
export function effectiveFieldConfidence(
  field: string,
  meta: Record<string, FieldExtractionMetaEntry>,
  globalScore: number | null | undefined,
): number | null {
  const row = meta[field];
  const c = row?.confidence;
  if (typeof c === "number" && Number.isFinite(c)) {
    return Math.min(1, Math.max(0, c));
  }
  if (globalScore != null && Number.isFinite(globalScore)) {
    return Math.min(1, Math.max(0, globalScore));
  }
  return null;
}

export type ConfidenceBand = "high" | "medium" | "low" | "unrated";

export function confidenceBand(score: number | null): ConfidenceBand {
  if (score == null || Number.isNaN(score)) {
    return "unrated";
  }
  if (score >= 0.78) {
    return "high";
  }
  if (score >= 0.55) {
    return "medium";
  }
  return "low";
}
