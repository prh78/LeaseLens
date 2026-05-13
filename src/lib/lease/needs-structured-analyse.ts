import type { Tables } from "@/lib/supabase/database.types";

type AnalyseGateRow = Pick<
  Tables<"extracted_data">,
  "raw_text" | "ambiguous_language" | "manual_review_recommended"
>;

/**
 * True when PDF text exists but OpenAI structured `/api/analyse` has not completed successfully yet.
 * After a successful analyse, `ambiguous_language` and `manual_review_recommended` are always booleans.
 */
export function needsStructuredAnalyse(
  extractionStatus: Tables<"leases">["extraction_status"],
  extracted: AnalyseGateRow | null,
): boolean {
  if (extractionStatus !== "complete" || !extracted) {
    return false;
  }
  const raw = extracted.raw_text;
  if (typeof raw !== "string" || !raw.trim()) {
    return false;
  }
  return extracted.ambiguous_language === null && extracted.manual_review_recommended === null;
}
