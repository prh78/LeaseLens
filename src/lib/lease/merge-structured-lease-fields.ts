import type { LeaseAnalyseOutput } from "@/lib/lease/lease-analyse-schema";
import type { Json } from "@/lib/supabase/database.types";

export const MERGEABLE_STRUCTURED_KEYS: readonly (keyof LeaseAnalyseOutput)[] = [
  "commencement_date",
  "expiry_date",
  "break_dates",
  "notice_period_days",
  "rent_review_dates",
  "repairing_obligation",
  "service_charge_responsibility",
  "reinstatement_required",
  "vacant_possession_required",
  "conditional_break_clause",
  "ambiguous_language",
  "manual_review_recommended",
  "confidence_score",
  "source_snippets",
  "field_extraction_meta",
] as const;

const MERGEABLE_KEYS = new Set<keyof LeaseAnalyseOutput>(MERGEABLE_STRUCTURED_KEYS);

export function isMergeableStructuredKey(key: string): key is keyof LeaseAnalyseOutput {
  return MERGEABLE_KEYS.has(key as keyof LeaseAnalyseOutput);
}

/**
 * Parses `lease_documents.supersedes_fields` (JSON array of column / output keys).
 */
export function parseSupersedesFields(json: Json | null | undefined): (keyof LeaseAnalyseOutput)[] {
  if (json == null || !Array.isArray(json)) {
    return [];
  }
  const out: (keyof LeaseAnalyseOutput)[] = [];
  for (const item of json) {
    if (typeof item !== "string") {
      continue;
    }
    if (MERGEABLE_KEYS.has(item as keyof LeaseAnalyseOutput)) {
      out.push(item as keyof LeaseAnalyseOutput);
    }
  }
  return out;
}

/**
 * Applies supplemental structured output onto `base` for the listed keys only.
 * `source_snippets` are shallow-merged when that key is overridden.
 */
export function mergeStructuredLeaseFields(
  base: LeaseAnalyseOutput,
  patch: LeaseAnalyseOutput,
  keys: readonly (keyof LeaseAnalyseOutput)[],
): LeaseAnalyseOutput {
  if (keys.length === 0) {
    return base;
  }
  const next: LeaseAnalyseOutput = { ...base };
  for (const key of keys) {
    if (key === "source_snippets") {
      next.source_snippets = { ...base.source_snippets, ...patch.source_snippets };
      continue;
    }
    if (key === "field_extraction_meta") {
      next.field_extraction_meta = { ...base.field_extraction_meta, ...patch.field_extraction_meta };
      continue;
    }
    (next as Record<string, unknown>)[key] = patch[key] as unknown;
  }
  return next;
}
