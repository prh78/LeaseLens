import { buildDashboardData } from "@/lib/dashboard/build-dashboard-data";
import type { DashboardData } from "@/lib/dashboard/types";
import type { Tables } from "@/lib/supabase/database.types";
import type { LeaseLensServerClient } from "@/lib/supabase/server";

type LeaseWithExtracted = Tables<"leases"> & {
  extracted_data: Tables<"extracted_data"> | Tables<"extracted_data">[] | null;
};

/**
 * Loads the signed-in user's leases (with extracted milestones) and builds dashboard data
 * including denormalised next-action fields when present.
 */
export async function fetchDashboardData(
  supabase: LeaseLensServerClient,
  userId: string,
): Promise<DashboardData> {
  const { data: leaseRows, error: leaseError } = await supabase
    .from("leases")
    .select(
      `
      id,
      property_name,
      overall_risk,
      extraction_status,
      upload_date,
      next_action_type,
      next_action_date,
      next_action_days_remaining,
      next_action_urgency,
      extracted_data (
        expiry_date,
        break_dates,
        notice_period_days,
        rent_review_dates,
        ambiguous_language,
        manual_review_recommended
      )
    `,
    )
    .eq("user_id", userId)
    .order("upload_date", { ascending: false });

  if (leaseError) {
    throw new Error(leaseError.message);
  }

  const leases = (leaseRows ?? []) as LeaseWithExtracted[];
  return buildDashboardData(leases);
}
