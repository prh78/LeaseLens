import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { syncLeaseAlerts } from "@/lib/alerts/sync-lease-alerts";
import { parseBearerFromRequest } from "@/lib/auth/bearer";
import type { LeaseAnalyseOutput } from "@/lib/lease/lease-analyse-schema";
import { analyseLeaseTextWithOpenAI } from "@/lib/lease/openai-analyse";
import type { Database, Json } from "@/lib/supabase/database.types";
import { getPublicEnv } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_LEASE_TEXT_CHARS = 120_000;

type AnalyseBody = {
  leaseId?: unknown;
  rawText?: unknown;
};

function nullIfEmpty(value: string | null): string | null {
  if (value == null) {
    return null;
  }
  const t = value.trim();
  return t === "" ? null : t;
}

function applyConservativeOverrides(data: LeaseAnalyseOutput): LeaseAnalyseOutput {
  return {
    ...data,
    manual_review_recommended: data.manual_review_recommended || data.ambiguous_language,
  };
}

function truncateError(message: string, max = 2000): string {
  if (message.length <= max) {
    return message;
  }
  return `${message.slice(0, max)}…`;
}

/**
 * POST /api/analyse
 *
 * Body: `{ "leaseId": "<uuid>", "rawText"?: string }`
 * - Loads `extracted_data.raw_text` for the lease unless `rawText` is provided (must still own the lease).
 * - Calls OpenAI with retries until JSON passes Zod schema validation.
 * - Upserts `extracted_data` with structured fields.
 *
 * Auth: `Authorization: Bearer <user access token>`
 * Env: `OPENAI_API_KEY`, optional `OPENAI_MODEL` (default `gpt-4o-mini`)
 */
export async function POST(request: Request) {
  const bearer = parseBearerFromRequest(request);
  if (!bearer) {
    return NextResponse.json({ error: "Missing or invalid Authorization header." }, { status: 401 });
  }

  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = getPublicEnv();

  const authClient = createClient<Database>(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser(bearer);

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: AnalyseBody;
  try {
    body = (await request.json()) as AnalyseBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const leaseId = typeof body.leaseId === "string" ? body.leaseId.trim() : "";
  const rawTextOverride = typeof body.rawText === "string" ? body.rawText : undefined;

  if (!leaseId) {
    return NextResponse.json({ error: "leaseId is required." }, { status: 400 });
  }

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return NextResponse.json(
      {
        error:
          "OPENAI_API_KEY is not set. Add it to .env.local (see .env.example) and restart the dev server.",
      },
      { status: 503 },
    );
  }

  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceRole) {
    return NextResponse.json(
      { error: "Server configuration: set SUPABASE_SERVICE_ROLE_KEY." },
      { status: 503 },
    );
  }

  const admin = createClient<Database>(NEXT_PUBLIC_SUPABASE_URL, serviceRole, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data: lease, error: leaseError } = await admin
    .from("leases")
    .select("id, user_id")
    .eq("id", leaseId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (leaseError) {
    return NextResponse.json({ error: leaseError.message }, { status: 500 });
  }

  if (!lease) {
    return NextResponse.json({ error: "Lease not found." }, { status: 404 });
  }

  const { data: extractedRow, error: extractedErr } = await admin
    .from("extracted_data")
    .select("raw_text")
    .eq("lease_id", leaseId)
    .maybeSingle();

  if (extractedErr) {
    return NextResponse.json({ error: extractedErr.message }, { status: 500 });
  }

  const textSource = rawTextOverride ?? extractedRow?.raw_text ?? "";
  const trimmed = textSource.trim();

  if (!trimmed) {
    return NextResponse.json(
      { error: "No lease text available. Run PDF extraction first or pass rawText in the request body." },
      { status: 400 },
    );
  }

  const leaseText =
    trimmed.length > MAX_LEASE_TEXT_CHARS ? trimmed.slice(0, MAX_LEASE_TEXT_CHARS) : trimmed;

  let structured: LeaseAnalyseOutput;
  let attemptsUsed: number;
  try {
    const result = await analyseLeaseTextWithOpenAI(leaseText);
    structured = applyConservativeOverrides(result.data);
    attemptsUsed = result.attemptsUsed;
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "OpenAI analyse failed.";
    const safe = truncateError(message);
    await admin
      .from("leases")
      .update({ extraction_status: "failed", extraction_error: safe })
      .eq("id", leaseId)
      .eq("user_id", user.id);

    return NextResponse.json({ error: message, leaseId }, { status: 502 });
  }

  const preservedRaw = extractedRow?.raw_text ?? (rawTextOverride ? rawTextOverride : null);

  const upsertRow = {
    lease_id: leaseId,
    raw_text: preservedRaw,
    commencement_date: structured.commencement_date,
    expiry_date: structured.expiry_date,
    break_dates: structured.break_dates as unknown as Json,
    notice_period_days: structured.notice_period_days,
    rent_review_dates: structured.rent_review_dates as unknown as Json,
    repairing_obligation: nullIfEmpty(structured.repairing_obligation),
    service_charge_responsibility: nullIfEmpty(structured.service_charge_responsibility),
    reinstatement_required: structured.reinstatement_required,
    vacant_possession_required: structured.vacant_possession_required,
    conditional_break_clause: nullIfEmpty(structured.conditional_break_clause),
    ambiguous_language: structured.ambiguous_language,
    manual_review_recommended: structured.manual_review_recommended,
    confidence_score: structured.confidence_score,
    source_snippets: structured.source_snippets as unknown as Json,
  };

  const { error: upsertError } = await admin.from("extracted_data").upsert(upsertRow, {
    onConflict: "lease_id",
  });

  if (upsertError) {
    await admin
      .from("leases")
      .update({ extraction_status: "failed", extraction_error: truncateError(upsertError.message) })
      .eq("id", leaseId)
      .eq("user_id", user.id);

    return NextResponse.json({ error: upsertError.message, leaseId }, { status: 500 });
  }

  const { error: leaseDoneErr } = await admin
    .from("leases")
    .update({ extraction_status: "complete", extraction_error: null })
    .eq("id", leaseId)
    .eq("user_id", user.id);

  if (leaseDoneErr) {
    return NextResponse.json({ error: leaseDoneErr.message, leaseId }, { status: 500 });
  }

  try {
    await syncLeaseAlerts(admin, leaseId);
  } catch (syncCause) {
    console.error("syncLeaseAlerts failed:", syncCause);
  }

  return NextResponse.json({
    leaseId,
    attemptsUsed,
    ...structured,
  });
}
