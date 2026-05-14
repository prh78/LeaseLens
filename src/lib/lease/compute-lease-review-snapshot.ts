import type { DocumentConflictEntry } from "@/lib/lease/lease-detail-audit";
import type { DateAmbiguityItem, DateFieldConfidenceMap, FieldExtractionMetaEntry } from "@/lib/lease/field-extraction-meta";
import type { LeaseReviewPriority, LeaseReviewStatus } from "@/lib/supabase/database.types";

export type LeaseReviewSnapshot = Readonly<{
  review_status: LeaseReviewStatus;
  review_priority: LeaseReviewPriority | null;
  review_reason: string | null;
  review_affected_fields: readonly string[];
}>;

const LOW_FIELD_CONF = 0.55;
const LOW_GLOBAL_CONF = 0.5;

function uniqueStrings(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const t = v.trim();
    if (!t || seen.has(t)) {
      continue;
    }
    seen.add(t);
    out.push(t);
  }
  return out;
}

function lowConfidenceDateKeys(map: DateFieldConfidenceMap | null | undefined): string[] {
  if (!map) {
    return [];
  }
  const out: string[] = [];
  for (const [k, v] of Object.entries(map)) {
    if (typeof v === "number" && Number.isFinite(v) && v < LOW_FIELD_CONF) {
      out.push(k);
    }
  }
  return out;
}

/**
 * Derives queue fields from structured extraction output (runs after each successful analyse).
 */
export function computeLeaseReviewSnapshot(input: Readonly<{
  manualReviewRecommended: boolean;
  ambiguousLanguage: boolean;
  confidenceScore: number | null;
  documentConflicts: readonly DocumentConflictEntry[];
  fieldExtractionMeta: Record<string, FieldExtractionMetaEntry>;
  dateAmbiguities?: readonly DateAmbiguityItem[];
  dateFieldConfidence?: DateFieldConfidenceMap | null;
}>): LeaseReviewSnapshot {
  const conflictFields = input.documentConflicts.map((c) => c.field);
  const lowConfidenceFields = Object.entries(input.fieldExtractionMeta)
    .filter(([, meta]) => typeof meta.confidence === "number" && meta.confidence < LOW_FIELD_CONF)
    .map(([k]) => k);
  const dateAmb = input.dateAmbiguities ?? [];
  const lowDateKeys = lowConfidenceDateKeys(input.dateFieldConfidence ?? null);

  const affected = uniqueStrings([
    ...conflictFields,
    ...lowConfidenceFields,
    ...lowDateKeys,
    ...(dateAmb.length > 0 ? ["date_ambiguities"] : []),
    ...(input.ambiguousLanguage ? ["ambiguous_language"] : []),
    ...(input.manualReviewRecommended ? ["manual_review_recommended"] : []),
  ]);

  const globalLow =
    input.confidenceScore != null &&
    Number.isFinite(input.confidenceScore) &&
    input.confidenceScore < LOW_GLOBAL_CONF;

  const needsReview =
    input.manualReviewRecommended ||
    input.ambiguousLanguage ||
    input.documentConflicts.length > 0 ||
    lowConfidenceFields.length > 0 ||
    lowDateKeys.length > 0 ||
    dateAmb.length > 0 ||
    globalLow;

  if (!needsReview) {
    return {
      review_status: "not_required",
      review_priority: null,
      review_reason: null,
      review_affected_fields: [],
    };
  }

  const reasons: string[] = [];
  if (input.documentConflicts.length > 0) {
    reasons.push(
      `Overlapping amendments on ${input.documentConflicts.length} structured field${input.documentConflicts.length === 1 ? "" : "s"}.`,
    );
  }
  if (input.ambiguousLanguage) {
    reasons.push("Ambiguous or hedged language detected in the lease text.");
  }
  if (input.manualReviewRecommended) {
    reasons.push("Model recommended manual verification.");
  }
  if (dateAmb.length > 0) {
    reasons.push(
      `Date classification uncertainty (${dateAmb.length} issue${dateAmb.length === 1 ? "" : "s"} recorded).`,
    );
  }
  if (lowConfidenceFields.length > 0) {
    reasons.push(`Low per-field confidence on: ${lowConfidenceFields.slice(0, 6).join(", ")}${lowConfidenceFields.length > 6 ? "…" : ""}.`);
  }
  if (lowDateKeys.length > 0) {
    reasons.push(`Low confidence on date field(s): ${lowDateKeys.join(", ")}.`);
  }
  if (globalLow) {
    reasons.push(`Overall model confidence is low (${(input.confidenceScore ?? 0).toFixed(2)}).`);
  }

  let priority: LeaseReviewPriority = "low";
  if (input.documentConflicts.length > 0 || (input.manualReviewRecommended && globalLow)) {
    priority = "high";
  } else if (
    input.manualReviewRecommended ||
    input.ambiguousLanguage ||
    lowConfidenceFields.length > 0 ||
    lowDateKeys.length > 0 ||
    dateAmb.length > 0
  ) {
    priority = "medium";
  }

  return {
    review_status: "needs_review",
    review_priority: priority,
    review_reason: reasons.length ? reasons.join(" ") : "Review recommended based on extraction output.",
    review_affected_fields: affected,
  };
}
