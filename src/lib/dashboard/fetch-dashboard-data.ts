import { buildDashboardData } from "@/lib/dashboard/build-dashboard-data";
import type { DashboardData, DashboardAlertSourceRow } from "@/lib/dashboard/types";
import type { Tables } from "@/lib/supabase/database.types";
import type { LeaseLensServerClient } from "@/lib/supabase/server";

type LeaseWithExtracted = Tables<"leases"> & {
  extracted_data: Tables<"extracted_data"> | Tables<"extracted_data">[] | null;
};

type AlertRowRaw = {
  id: string;
  alert_type: string;
  trigger_date: string;
  event_kind: string | null;
  event_date: string | null;
  horizon_days: number | null;
  lease_id: string;
};

/**
 * Loads the signed-in user's leases (with extracted milestones) and pending alerts for the dashboard.
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
      extracted_data (
        expiry_date,
        break_dates,
        rent_review_dates
      )
    `,
    )
    .eq("user_id", userId)
    .order("upload_date", { ascending: false });

  if (leaseError) {
    throw new Error(leaseError.message);
  }

  const leases = (leaseRows ?? []) as LeaseWithExtracted[];
  const leaseIds = leases.map((l) => l.id);
  const propertyByLeaseId = Object.fromEntries(leases.map((l) => [l.id, l.property_name]));

  let alertRows: DashboardAlertSourceRow[] = [];
  if (leaseIds.length > 0) {
    const { data: alerts, error: alertError } = await supabase
      .from("alerts")
      .select(
        `
        id,
        alert_type,
        trigger_date,
        event_kind,
        event_date,
        horizon_days,
        lease_id
      `,
      )
      .in("lease_id", leaseIds)
      .eq("sent_status", "pending")
      .order("trigger_date", { ascending: true })
      .limit(25);

    if (alertError) {
      throw new Error(alertError.message);
    }

    alertRows = (alerts ?? []).map((a) => ({
      ...(a as AlertRowRaw),
      property_name: propertyByLeaseId[(a as AlertRowRaw).lease_id] ?? "Lease",
    }));
  }

  return buildDashboardData(leases, alertRows);
}
