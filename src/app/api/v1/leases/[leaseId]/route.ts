import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { parseBearerFromRequest } from "@/lib/auth/bearer";
import { isValidLeaseDocumentPdfStoragePath, isValidLeasePdfStoragePath } from "@/lib/lease/lease-storage-path";
import { uniqueStoragePaths } from "@/lib/lease/unique-storage-paths";
import type { Database } from "@/lib/supabase/database.types";
import { getPublicEnv } from "@/lib/env";
import { leaseExtractionStatusConstraintHint } from "@/lib/supabase/lease-schema-errors";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PatchLeaseBody = {
  storagePath?: unknown;
  propertyName?: unknown;
};

/**
 * PATCH /api/v1/leases/:leaseId
 *
 * - `{ "propertyName": "…" }` — rename the property (any extraction status).
 * - `{ "storagePath": "…" }` — attach primary PDF after upload (`uploading` → `extracting`).
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

  let body: PatchLeaseBody;
  try {
    body = (await request.json()) as PatchLeaseBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const propertyName = typeof body.propertyName === "string" ? body.propertyName.trim() : "";
  const storagePath = typeof body.storagePath === "string" ? body.storagePath.trim() : "";

  if (propertyName && storagePath) {
    return NextResponse.json(
      { error: "Send only one of propertyName or storagePath." },
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

  if (propertyName) {
    if (propertyName.length > 500) {
      return NextResponse.json(
        { error: "Property name is required (max 500 characters)." },
        { status: 400 },
      );
    }

    const { data: updated, error: nameErr } = await admin
      .from("leases")
      .update({ property_name: propertyName })
      .eq("id", leaseId)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();

    if (nameErr) {
      return NextResponse.json({ error: nameErr.message }, { status: 500 });
    }

    if (!updated) {
      return NextResponse.json({ error: "Lease not found." }, { status: 404 });
    }

    return NextResponse.json({ leaseId, propertyName });
  }

  if (!storagePath) {
    return NextResponse.json({ error: "Missing storage path or propertyName." }, { status: 400 });
  }

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

  const { data: primaryDoc, error: primaryErr } = await admin
    .from("lease_documents")
    .select("id")
    .eq("lease_id", leaseId)
    .eq("document_type", "primary_lease")
    .maybeSingle();

  if (primaryErr) {
    return NextResponse.json({ error: primaryErr.message }, { status: 500 });
  }

  if (!primaryDoc) {
    return NextResponse.json({ error: "Primary lease document row is missing." }, { status: 500 });
  }

  const pathOk =
    isValidLeaseDocumentPdfStoragePath(user.id, leaseId, primaryDoc.id, storagePath) ||
    isValidLeasePdfStoragePath(user.id, leaseId, storagePath);

  if (!pathOk) {
    return NextResponse.json({ error: "Invalid storage path for this lease." }, { status: 400 });
  }

  const { error: docUpdErr } = await admin
    .from("lease_documents")
    .update({
      file_url: storagePath,
      processing_status: "extracting_text",
    })
    .eq("id", primaryDoc.id)
    .eq("lease_id", leaseId);

  if (docUpdErr) {
    return NextResponse.json({ error: docUpdErr.message }, { status: 500 });
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

/**
 * DELETE /api/v1/leases/:leaseId
 *
 * Removes all storage objects for this lease, then deletes the lease row (cascades to
 * `extracted_data`, `alerts`, `lease_documents`).
 */
export async function DELETE(_request: Request, context: { params: Promise<{ leaseId: string }> }) {
  const { leaseId: rawId } = await context.params;
  const leaseId = rawId?.trim() ?? "";

  if (!UUID.test(leaseId)) {
    return NextResponse.json({ error: "Invalid lease id." }, { status: 400 });
  }

  const bearer = parseBearerFromRequest(_request);
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

  const { data: lease, error: leaseErr } = await admin
    .from("leases")
    .select("id, file_url")
    .eq("id", leaseId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (leaseErr) {
    return NextResponse.json({ error: leaseErr.message }, { status: 500 });
  }

  if (!lease) {
    return NextResponse.json({ error: "Lease not found." }, { status: 404 });
  }

  const { data: docs, error: docsErr } = await admin.from("lease_documents").select("file_url").eq("lease_id", leaseId);

  if (docsErr) {
    return NextResponse.json({ error: docsErr.message }, { status: 500 });
  }

  const paths = uniqueStoragePaths([lease.file_url, ...(docs ?? []).map((d) => d.file_url)]);

  if (paths.length > 0) {
    const { error: rmErr } = await admin.storage.from("leases").remove(paths);
    if (rmErr) {
      console.error("lease delete storage remove:", rmErr.message);
      return NextResponse.json({ error: `Could not remove files from storage: ${rmErr.message}` }, { status: 502 });
    }
  }

  const { error: delErr } = await admin.from("leases").delete().eq("id", leaseId).eq("user_id", user.id);

  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true as const, leaseId });
}
