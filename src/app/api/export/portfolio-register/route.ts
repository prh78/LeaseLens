import { NextResponse } from "next/server";

import { buildPortfolioRegisterCsv } from "@/lib/export/build-portfolio-register-csv";
import { fetchLeasesForExport } from "@/lib/export/fetch-leases-for-export";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function dispositionFilename(stem: string): string {
  const base = stem.replace(/[^\w\-. ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 72) || "export";
  return `${base}.csv`;
}

/**
 * GET /api/export/portfolio-register
 *
 * CSV of the signed-in user's portfolio (one row per lease). Requires an authenticated session cookie.
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
  const csv = buildPortfolioRegisterCsv(rows);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${dispositionFilename("portfolio-lease-register")}"`,
    },
  });
}
