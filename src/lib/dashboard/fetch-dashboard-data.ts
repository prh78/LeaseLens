import { buildDashboardData } from "@/lib/dashboard/build-dashboard-data";
import { fetchDisplayLocaleForUser } from "@/lib/user/fetch-display-locale";
import type { DashboardData } from "@/lib/dashboard/types";
import type { Tables } from "@/lib/supabase/database.types";
import type { LeaseLensServerClient } from "@/lib/supabase/server";

type LeaseWithExtracted = Tables<"leases"> & {
  extracted_data: Tables<"extracted_data"> | Tables<"extracted_data">[] | null;
};

/**
 * Loads the signed-in user's leases (with extracted milestones used for next-action computation).
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
      property_type,
      lease_jurisdiction,
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
        expiry_date,
        break_dates,
        break_clause_status,
        notice_period_days,
        notice_period_spec,
        premises_country,
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
  const displayLocale = await fetchDisplayLocaleForUser(supabase, userId);
  return buildDashboardData(leases, displayLocale);
}
