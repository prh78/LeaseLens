import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { parseBearerFromRequest } from "@/lib/auth/bearer";
import type { Database, Json } from "@/lib/supabase/database.types";
import { getPublicEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PatchBody = {
  reviewStatus?: unknown;
};

/**
 * PATCH /api/v1/leases/:leaseId/review
 *
 * Body: `{ "reviewStatus": "verified" | "unresolved" }` — only from `needs_review`.
 * Clears queue fields (`review_priority`, `review_reason`, `review_affected_fields`).
 *
 * Auth: `Authorization: Bearer <user access token>`
 */
export async function PATCH(request: Request, context: { params: Promise<{ leaseId: string }> }) {
  const { leaseId: rawId } = await context.params;
  const leaseId = rawId?.trim() ?? "";

  if (!UUID.test(leaseId)) {
    return NextResponse.json({ error: "Invalid lease id." }, { status: 400 });
  }

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

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const reviewStatus = typeof body.reviewStatus === "string" ? body.reviewStatus.trim() : "";
  if (reviewStatus !== "verified" && reviewStatus !== "unresolved") {
    return NextResponse.json(
      { error: 'reviewStatus must be "verified" or "unresolved".' },
      { status: 400 },
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

  const { data: existing, error: loadErr } = await admin
    .from("leases")
    .select("review_status")
    .eq("id", leaseId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (loadErr) {
    return NextResponse.json({ error: loadErr.message }, { status: 500 });
  }

  if (!existing) {
    return NextResponse.json({ error: "Lease not found." }, { status: 404 });
  }

  if (existing.review_status !== "needs_review") {
    return NextResponse.json(
      { error: "Lease is not awaiting review (status is not needs_review)." },
      { status: 409 },
    );
  }

  const { error: updateErr } = await admin
    .from("leases")
    .update({
      review_status: reviewStatus,
      review_priority: null,
      review_reason: null,
      review_affected_fields: [] as Json,
    })
    .eq("id", leaseId)
    .eq("user_id", user.id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ leaseId, reviewStatus });
}
