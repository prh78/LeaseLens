import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { syncLeaseAlerts } from "@/lib/alerts/sync-lease-alerts";
import { syncLeaseNextAction } from "@/lib/lease/sync-lease-next-action";
import {
  breakDatesFromExtracted,
  mergeBreakClauseEntryPatch,
  parseBreakClauseEntryMap,
  serialiseBreakClauseStatusForDb,
} from "@/lib/lease/break-clause-status";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const LEASE_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RouteContext = Readonly<{
  params: Promise<{ leaseId: string }>;
}>;

type PatchBody = Readonly<{
  /** @deprecated Prefer `entries` for served notice metadata. */
  statuses?: unknown;
  entries?: unknown;
}>;

export async function PATCH(request: Request, context: RouteContext) {
  const { leaseId } = await context.params;

  if (!LEASE_ID_RE.test(leaseId)) {
    return NextResponse.json({ error: "Invalid lease id" }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const raw = body.entries ?? body.statuses;
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return NextResponse.json(
      { error: "Body must include entries or statuses object." },
      { status: 400 },
    );
  }

  const { data: lease, error: leaseErr } = await supabase
    .from("leases")
    .select("id")
    .eq("id", leaseId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (leaseErr || !lease) {
    return NextResponse.json({ error: "Lease not found." }, { status: 404 });
  }

  const { data: extracted, error: exErr } = await supabase
    .from("extracted_data")
    .select("break_dates, break_clause_status")
    .eq("lease_id", leaseId)
    .maybeSingle();

  if (exErr) {
    return NextResponse.json({ error: exErr.message }, { status: 500 });
  }

  if (!extracted) {
    return NextResponse.json({ error: "No extracted data for this lease." }, { status: 404 });
  }

  const allowed = breakDatesFromExtracted(extracted.break_dates);
  const current = parseBreakClauseEntryMap(extracted.break_clause_status);
  const nextEntries = mergeBreakClauseEntryPatch(current, allowed, raw as Record<string, unknown>);
  const next = serialiseBreakClauseStatusForDb(nextEntries);

  const { error: upErr } = await supabase
    .from("extracted_data")
    .update({ break_clause_status: next })
    .eq("lease_id", leaseId);

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  try {
    await syncLeaseNextAction(supabase, leaseId);
  } catch (cause) {
    console.error("syncLeaseNextAction after break status:", cause);
  }

  try {
    await syncLeaseAlerts(supabase, leaseId);
  } catch (cause) {
    console.error("syncLeaseAlerts after break status:", cause);
  }

  revalidatePath("/dashboard");
  revalidatePath(`/lease/${leaseId}`);

  return NextResponse.json({ leaseId, break_clause_status: next });
}
