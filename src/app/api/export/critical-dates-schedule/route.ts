import { NextResponse } from "next/server";

import { buildCriticalDatesScheduleCsv } from "@/lib/export/build-critical-dates-schedule-csv";
import { fetchLeasesForExport } from "@/lib/export/fetch-leases-for-export";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function dispositionFilename(stem: string): string {
  const base = stem.replace(/[^\w\-. ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 72) || "export";
  return `${base}.csv`;
}

/**
 * GET /api/export/critical-dates-schedule
 *
 * CSV of dated milestones and prioritised actions across the portfolio. Session cookie auth.
 */
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await fetchLeasesForExport(supabase, user.id);
  const csv = buildCriticalDatesScheduleCsv(rows);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${dispositionFilename("critical-dates-schedule")}"`,
    },
  });
}
