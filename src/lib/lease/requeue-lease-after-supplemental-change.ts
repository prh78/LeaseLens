import type { SupabaseClient } from "@supabase/supabase-js";

import { syncLeaseNextAction } from "@/lib/lease/sync-lease-next-action";
import type { Database } from "@/lib/supabase/database.types";

type Admin = SupabaseClient<Database>;

/**
 * After supplemental PDF rows are removed, clear structured-analyse gates and send the lease
 * back through extraction so merged `raw_text` matches remaining documents.
 */
export async function requeueLeaseExtractionAfterSupplementalChange(
  admin: Admin,
  leaseId: string,
  userId: string,
): Promise<void> {
  await admin
    .from("extracted_data")
    .update({
      ambiguous_language: null,
      manual_review_recommended: null,
    })
    .eq("lease_id", leaseId);

  const { error: leaseUpdErr } = await admin
    .from("leases")
    .update({
      extraction_status: "extracting",
      extraction_error: null,
    })
    .eq("id", leaseId)
    .eq("user_id", userId);

  if (leaseUpdErr) {
    throw new Error(leaseUpdErr.message);
  }

  try {
    await syncLeaseNextAction(admin, leaseId);
  } catch (cause) {
    console.error("syncLeaseNextAction after supplemental change:", cause);
  }
}
