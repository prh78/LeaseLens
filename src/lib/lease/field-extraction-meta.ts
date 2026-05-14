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

export function parseFieldExtractionMeta(raw: Json | null | undefined): Record<string, FieldExtractionMetaEntry> {
  if (raw == null || !isRecord(raw)) {
    return {};
  }
  const out: Record<string, FieldExtractionMetaEntry> = {};
  for (const [field, v] of Object.entries(raw)) {
    if (!isRecord(v)) {
      continue;
    }
    const confidence =
      typeof v.confidence === "number" && Number.isFinite(v.confidence)
        ? Math.min(1, Math.max(0, v.confidence))
        : v.confidence === null
          ? null
          : undefined;
    const rationale = typeof v.rationale === "string" ? v.rationale : v.rationale === null ? null : undefined;
    const clause_reference =
      typeof v.clause_reference === "string"
        ? v.clause_reference
        : v.clause_reference === null
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
