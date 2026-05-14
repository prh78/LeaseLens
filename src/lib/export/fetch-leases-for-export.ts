import type { Tables } from "@/lib/supabase/database.types";
import type { LeaseLensServerClient } from "@/lib/supabase/server";

export type LeaseWithExtractedForExport = Tables<"leases"> & {
  extracted_data: Tables<"extracted_data"> | Tables<"extracted_data">[] | null;
};

const EXPORT_LEASE_SELECT = `
  id,
  property_name,
  property_type,
  overall_risk,
  extraction_status,
  upload_date,
  next_action_type,
  next_action_date,
  next_action_days_remaining,
  next_action_urgency,
  review_status,
  review_priority,
  review_reason,
  review_affected_fields,
  extracted_data (
    commencement_date,
    expiry_date,
    break_dates,
    notice_period_days,
    rent_review_dates,
    ambiguous_language,
    manual_review_recommended,
    repairing_obligation,
    reinstatement_required,
    service_charge_responsibility,
    vacant_possession_required,
    conditional_break_clause,
    confidence_score,
    source_snippets,
    field_extraction_meta,
    field_provenance,
    change_history,
    document_conflicts
  )
`;

/** Loads leases + extracted data for CSV / PDF export builders (dashboard scope). */
export async function fetchLeasesForExport(
  supabase: LeaseLensServerClient,
  userId: string,
): Promise<LeaseWithExtractedForExport[]> {
  const { data: leaseRows, error } = await supabase
    .from("leases")
    .select(EXPORT_LEASE_SELECT)
    .eq("user_id", userId)
    .order("upload_date", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (leaseRows ?? []) as LeaseWithExtractedForExport[];
}
