import { NextResponse } from "next/server";

import { buildLeaseSummaryPdfBytes } from "@/lib/export/lease-summary-pdf";
import { effectiveLeaseNextAction } from "@/lib/lease/effective-lease-next-action";
import { DEFAULT_DISPLAY_LOCALE } from "@/lib/lease/format-app-date";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { fetchDisplayLocaleForUser } from "@/lib/user/fetch-display-locale";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const LEASE_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RouteContext = Readonly<{
  params: Promise<{ leaseId: string }>;
}>;

function dispositionPdfFilename(propertyName: string): string {
  const base = propertyName.replace(/[^\w\-. ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 72) || "lease-summary";
  return `${base}.pdf`;
}

/**
 * GET /api/leases/:leaseId/export/summary
 *
 * PDF lease summary (operative terms + risk flags + next action). Session cookie auth.
 */
export async function GET(_request: Request, context: RouteContext) {
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

  const { data: lease, error: leaseError } = await supabase
    .from("leases")
    .select("*")
    .eq("id", leaseId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (leaseError) {
    return NextResponse.json({ error: leaseError.message }, { status: 500 });
  }

  if (!lease) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: extracted, error: extractedError } = await supabase
    .from("extracted_data")
    .select("*")
    .eq("lease_id", leaseId)
    .maybeSingle();

  if (extractedError) {
    return NextResponse.json({ error: extractedError.message }, { status: 500 });
  }

  const nextAction = effectiveLeaseNextAction(lease, extracted);
  const displayLocale = await fetchDisplayLocaleForUser(supabase, user.id);
  const bytes = await buildLeaseSummaryPdfBytes({
    lease,
    extracted,
    nextAction,
    displayLocale: displayLocale ?? DEFAULT_DISPLAY_LOCALE,
  });
  const filename = dispositionPdfFilename(lease.property_name);

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
