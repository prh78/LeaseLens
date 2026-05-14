import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { parseBearerFromRequest } from "@/lib/auth/bearer";
import { isValidLeasePdfStoragePath } from "@/lib/lease/lease-storage-path";
import type { Database } from "@/lib/supabase/database.types";
import { getPublicEnv } from "@/lib/env";
import { leaseExtractionStatusConstraintHint } from "@/lib/supabase/lease-schema-errors";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type AttachBody = {
  storagePath?: unknown;
};

/**
 * PATCH /api/v1/leases/:leaseId
 *
 * Attaches Storage path after PDF upload. Moves `extraction_status` from `uploading` → `extracting`.
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

  let body: AttachBody;
  try {
    body = (await request.json()) as AttachBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const storagePath = typeof body.storagePath === "string" ? body.storagePath.trim() : "";
  if (!storagePath || !isValidLeasePdfStoragePath(user.id, leaseId, storagePath)) {
    return NextResponse.json({ error: "Invalid storage path for this lease." }, { status: 400 });
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

  const { data: row, error: fetchErr } = await admin
    .from("leases")
    .select("id, extraction_status")
    .eq("id", leaseId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  if (!row) {
    return NextResponse.json({ error: "Lease not found." }, { status: 404 });
  }

  if (row.extraction_status !== "uploading") {
    return NextResponse.json(
      { error: `Lease is not awaiting file attachment (status: ${row.extraction_status}).` },
      { status: 409 },
    );
  }

  const { error: updErr } = await admin
    .from("leases")
    .update({
      file_url: storagePath,
      extraction_status: "extracting",
      extraction_error: null,
    })
    .eq("id", leaseId)
    .eq("user_id", user.id)
    .eq("extraction_status", "uploading");

  if (updErr) {
    const hint = leaseExtractionStatusConstraintHint(updErr);
    return NextResponse.json({ error: hint ?? updErr.message }, { status: hint ? 503 : 500 });
  }

  return NextResponse.json({ leaseId, extractionStatus: "extracting" as const });
}
