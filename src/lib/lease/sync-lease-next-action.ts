import type { SupabaseClient } from "@supabase/supabase-js";

import { computeLeaseNextAction } from "@/lib/lease/compute-lease-next-action";
import type { Database } from "@/lib/supabase/database.types";

type Admin = SupabaseClient<Database>;

const nullAction = {
  next_action_type: null as null,
  next_action_date: null as null,
  next_action_days_remaining: null as null,
  next_action_urgency: null as null,
};

/**
 * Recomputes `leases.next_action_*` from `extracted_data` when the lease is `complete`;
 * otherwise clears stored values (e.g. failed / in-flight extraction).
 */
export async function syncLeaseNextAction(admin: Admin, leaseId: string): Promise<void> {
  const { data: lease, error: leaseErr } = await admin
    .from("leases")
    .select("extraction_status")
    .eq("id", leaseId)
    .maybeSingle();

  if (leaseErr || !lease || (lease.extraction_status !== "complete" && lease.extraction_status !== "calculating_risks")) {
    await admin.from("leases").update(nullAction).eq("id", leaseId);
    return;
  }

  const { data: extracted, error: exErr } = await admin
    .from("extracted_data")
    .select(
      "expiry_date, break_dates, break_clause_status, notice_period_days, rent_review_dates, ambiguous_language, manual_review_recommended",
    )
    .eq("lease_id", leaseId)
    .maybeSingle();

  if (exErr || !extracted) {
    await admin.from("leases").update(nullAction).eq("id", leaseId);
    return;
  }

  const computed = computeLeaseNextAction(extracted);

  if (!computed) {
    await admin.from("leases").update(nullAction).eq("id", leaseId);
    return;
  }

  await admin
    .from("leases")
    .update({
      next_action_type: computed.action_type,
      next_action_date: computed.action_date,
      next_action_days_remaining: computed.days_remaining,
      next_action_urgency: computed.urgency_level,
    })
    .eq("id", leaseId);
}
