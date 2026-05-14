import type { DocumentConflictEntry } from "@/lib/lease/lease-detail-audit";
import type { Tables } from "@/lib/supabase/database.types";

export type LeaseRiskFlag = Readonly<{
  id: string;
  title: string;
  detail?: string | null;
  badge: "low" | "medium" | "high";
  critical?: boolean;
}>;

/**
 * Automated risk signals shown on the lease detail page and included in summary exports.
 */
export function collectLeaseRiskFlags(
  extracted: Tables<"extracted_data"> | null,
  documentConflicts: readonly DocumentConflictEntry[],
): LeaseRiskFlag[] {
  if (!extracted) {
    return [];
  }

  const flags: LeaseRiskFlag[] = [];

  if (documentConflicts.length > 0) {
    flags.push({
      id: "doc_conflicts",
      title: "Structured field conflicts across documents",
      detail: `${documentConflicts.length} overlapping amendment conflict(s) recorded on structured fields.`,
      badge: "high",
    });
  }

  if (extracted.manual_review_recommended === true) {
    flags.push({
      id: "manual",
      title: "Manual review recommended",
      detail: "Model flagged this lease for human verification.",
      badge: "high",
    });
  }
  if (extracted.ambiguous_language === true) {
    flags.push({
      id: "ambiguous",
      title: "Ambiguous language",
      detail: "Some clauses may be open to interpretation.",
      badge: "medium",
    });
  }
  if (extracted.conditional_break_clause && extracted.conditional_break_clause.trim()) {
    flags.push({
      id: "conditional_break",
      title: "Conditional break clause",
      detail: extracted.conditional_break_clause,
      badge: "medium",
    });
  }
  if (extracted.reinstatement_required === true) {
    flags.push({
      id: "reinstatement",
      title: "Reinstatement required",
      badge: "low",
    });
  }
  if (extracted.vacant_possession_required === true) {
    flags.push({
      id: "vacant",
      title: "Vacant possession required",
      badge: "low",
    });
  }

  return flags;
}
