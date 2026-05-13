import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { processDueAlerts } from "@/lib/alerts/process-due-alerts";
import type { Database } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return false;
  }
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/**
 * GET /api/cron/alerts
 *
 * Secured with `Authorization: Bearer <CRON_SECRET>`.
 * Intended for Vercel Cron (hourly) or manual `curl` while developing.
 * Sends due pending alerts via Resend and updates `sent_status`.
 */
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET?.trim()) {
    return NextResponse.json({ error: "CRON_SECRET is not set." }, { status: 503 });
  }

  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceRole) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set." }, { status: 503 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) {
    return NextResponse.json({ error: "NEXT_PUBLIC_SUPABASE_URL is not set." }, { status: 503 });
  }

  const admin = createClient<Database>(url, serviceRole, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { "x-client-info": "leaselens-cron-alerts" },
    },
  });

  if (!process.env.RESEND_API_KEY?.trim()) {
    return NextResponse.json(
      { error: "RESEND_API_KEY is not set; no emails were sent. Pending alerts were left unchanged." },
      { status: 503 },
    );
  }

  try {
    const summary = await processDueAlerts(admin);
    return NextResponse.json({ ok: true, ...summary });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "processDueAlerts failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
