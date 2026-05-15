import {
  computeLeaseNextAction,
  type ExtractedForNextAction,
  type LeaseNextActionResult,
} from "@/lib/lease/compute-lease-next-action";
import type { Tables } from "@/lib/supabase/database.types";

export function extractedRowToNextActionInput(row: Tables<"extracted_data">): ExtractedForNextAction {
  return {
    expiry_date: row.expiry_date,
    break_dates: row.break_dates,
    break_clause_status: row.break_clause_status,
    notice_period_days: row.notice_period_days,
    notice_period_spec: row.notice_period_spec,
    rent_review_dates: row.rent_review_dates,
    ambiguous_language: row.ambiguous_language,
    manual_review_recommended: row.manual_review_recommended,
  };
}

/**
 * Next critical action: computed from `extracted_data` when present (same inputs as lease detail).
 * Falls back to denormalised `leases.next_action_*` only when there is no extracted row.
 */
export function effectiveLeaseNextAction(
  lease: Tables<"leases">,
  extracted: Tables<"extracted_data"> | null,
): LeaseNextActionResult | null {
  if (extracted) {
    return computeLeaseNextAction(extractedRowToNextActionInput(extracted));
  }

  if (
    lease.extraction_status === "complete" &&
    lease.next_action_type != null &&
    lease.next_action_urgency != null
  ) {
    return {
      action_type: lease.next_action_type,
      action_date: lease.next_action_date,
      days_remaining: lease.next_action_days_remaining,
      urgency_level: lease.next_action_urgency,
    };
  }

  return null;
}
