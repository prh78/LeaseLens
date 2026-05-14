import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { parseBearerFromRequest } from "@/lib/auth/bearer";
import { requeueLeaseExtractionAfterSupplementalChange } from "@/lib/lease/requeue-lease-after-supplemental-change";
import { isValidLeaseDocumentPdfStoragePath } from "@/lib/lease/lease-storage-path";
import type { Database } from "@/lib/supabase/database.types";
import { getPublicEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type AttachDocumentBody = {
  storagePath?: unknown;
};

/**
 * PATCH /api/v1/leases/:leaseId/documents/:documentId
 *
 * Attaches Storage path after PDF upload for a supplemental document row.
 * Re-queues the lease for extraction (`extracting`).
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ leaseId: string; documentId: string }> },
) {
  const { leaseId: rawLeaseId, documentId: rawDocId } = await context.params;
  const leaseId = rawLeaseId?.trim() ?? "";
  const documentId = rawDocId?.trim() ?? "";

  if (!UUID.test(leaseId) || !UUID.test(documentId)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
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

  let body: AttachDocumentBody;
  try {
    body = (await request.json()) as AttachDocumentBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const storagePath = typeof body.storagePath === "string" ? body.storagePath.trim() : "";
  if (!storagePath || !isValidLeaseDocumentPdfStoragePath(user.id, leaseId, documentId, storagePath)) {
    return NextResponse.json({ error: "Invalid storage path for this document." }, { status: 400 });
  }

  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceRole) {
    return NextResponse.json({ error: "Server configuration: set SUPABASE_SERVICE_ROLE_KEY." }, { status: 503 });
  }

  const admin = createClient<Database>(NEXT_PUBLIC_SUPABASE_URL, serviceRole, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data: docRow, error: docErr } = await admin
    .from("lease_documents")
    .select("id, lease_id, document_type, processing_status")
    .eq("id", documentId)
    .eq("lease_id", leaseId)
    .maybeSingle();

  if (docErr) {
    return NextResponse.json({ error: docErr.message }, { status: 500 });
  }

  if (!docRow) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  const { data: lease, error: leaseErr } = await admin
    .from("leases")
    .select("id, user_id")
    .eq("id", leaseId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (leaseErr || !lease) {
    return NextResponse.json({ error: "Lease not found." }, { status: 404 });
  }

  if (docRow.document_type === "primary_lease") {
    return NextResponse.json({ error: "Use PATCH /api/v1/leases/:leaseId to attach the primary PDF." }, { status: 400 });
  }

  if (docRow.processing_status !== "uploading") {
    return NextResponse.json(
      { error: `Document is not awaiting file attachment (status: ${docRow.processing_status}).` },
      { status: 409 },
    );
  }

  const { error: docUpdErr } = await admin
    .from("lease_documents")
    .update({
      file_url: storagePath,
      processing_status: "pending",
    })
    .eq("id", documentId)
    .eq("lease_id", leaseId);

  if (docUpdErr) {
    return NextResponse.json({ error: docUpdErr.message }, { status: 500 });
  }

  const { error: leaseUpdErr } = await admin
    .from("leases")
    .update({
      extraction_status: "extracting",
      extraction_error: null,
    })
    .eq("id", leaseId)
    .eq("user_id", user.id);

  if (leaseUpdErr) {
    return NextResponse.json({ error: leaseUpdErr.message }, { status: 500 });
  }

  return NextResponse.json({
    leaseId,
    leaseDocumentId: documentId,
    extractionStatus: "extracting" as const,
  });
}

/**
 * DELETE /api/v1/leases/:leaseId/documents/:documentId
 *
 * Removes a **supplemental** document row and its PDF from storage, then re-queues extraction.
 */
export async function DELETE(_request: Request, context: { params: Promise<{ leaseId: string; documentId: string }> }) {
  const { leaseId: rawLeaseId, documentId: rawDocId } = await context.params;
  const leaseId = rawLeaseId?.trim() ?? "";
  const documentId = rawDocId?.trim() ?? "";

  if (!UUID.test(leaseId) || !UUID.test(documentId)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
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
    return NextResponse.json({ error: "Server configuration: set SUPABASE_SERVICE_ROLE_KEY." }, { status: 503 });
  }

  const admin = createClient<Database>(NEXT_PUBLIC_SUPABASE_URL, serviceRole, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data: docRow, error: docErr } = await admin
    .from("lease_documents")
    .select("id, lease_id, document_type, file_url")
    .eq("id", documentId)
    .eq("lease_id", leaseId)
    .maybeSingle();

  if (docErr) {
    return NextResponse.json({ error: docErr.message }, { status: 500 });
  }

  if (!docRow) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  const { data: lease, error: leaseErr } = await admin
    .from("leases")
    .select("id, user_id")
    .eq("id", leaseId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (leaseErr || !lease) {
    return NextResponse.json({ error: "Lease not found." }, { status: 404 });
  }

  if (docRow.document_type === "primary_lease") {
    return NextResponse.json({ error: "The primary lease cannot be deleted here." }, { status: 400 });
  }

  const path = docRow.file_url?.trim();
  if (path) {
    const { error: rmErr } = await admin.storage.from("leases").remove([path]);
    if (rmErr) {
      console.error("supplemental delete storage:", rmErr.message);
      return NextResponse.json({ error: `Could not remove file from storage: ${rmErr.message}` }, { status: 502 });
    }
  }

  const { error: delErr } = await admin.from("lease_documents").delete().eq("id", documentId).eq("lease_id", leaseId);

  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  try {
    await requeueLeaseExtractionAfterSupplementalChange(admin, leaseId, user.id);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Could not re-queue lease.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true as const, leaseId, leaseDocumentId: documentId });
}
