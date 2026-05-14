import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { parseBearerFromRequest } from "@/lib/auth/bearer";
import { isLeaseDocumentType } from "@/lib/lease/lease-document-types";
import { parseSupersedesFields } from "@/lib/lease/merge-structured-lease-fields";
import type { Database, Json } from "@/lib/supabase/database.types";
import { getPublicEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function supersedesJsonFromBody(raw: unknown): Json {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((item): item is string => typeof item === "string") as Json;
}

type CreateDocumentBody = {
  documentType?: unknown;
  supersedesFields?: unknown;
};

/**
 * POST /api/v1/leases/:leaseId/documents
 *
 * Creates a supplemental lease document row (not primary). Client uploads to
 * `{userId}/{leaseId}/{documentId}.pdf` then PATCHes this document with `storagePath`.
 */
export async function POST(request: Request, context: { params: Promise<{ leaseId: string }> }) {
  const { leaseId: rawLeaseId } = await context.params;
  const leaseId = rawLeaseId?.trim() ?? "";

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

  let body: CreateDocumentBody;
  try {
    body = (await request.json()) as CreateDocumentBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const documentType = typeof body.documentType === "string" ? body.documentType.trim() : "";
  if (!documentType || documentType === "primary_lease" || !isLeaseDocumentType(documentType)) {
    return NextResponse.json({ error: "Invalid documentType." }, { status: 400 });
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

  const { data: lease, error: leaseErr } = await admin
    .from("leases")
    .select("id, extraction_status")
    .eq("id", leaseId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (leaseErr) {
    return NextResponse.json({ error: leaseErr.message }, { status: 500 });
  }

  if (!lease) {
    return NextResponse.json({ error: "Lease not found." }, { status: 404 });
  }

  if (lease.extraction_status !== "complete") {
    return NextResponse.json(
      { error: "Supplemental documents can only be added when the lease is complete." },
      { status: 409 },
    );
  }

  const supersedesJson = supersedesJsonFromBody(body.supersedesFields);
  const allowedKeys = parseSupersedesFields(supersedesJson);
  const storedSupersedes = allowedKeys as unknown as Json;

  const { data: doc, error: insErr } = await admin
    .from("lease_documents")
    .insert({
      lease_id: leaseId,
      document_type: documentType,
      file_url: null,
      processing_status: "uploading",
      supersedes_fields: storedSupersedes,
    })
    .select("id")
    .single();

  if (insErr || !doc) {
    return NextResponse.json({ error: insErr?.message ?? "Could not create document." }, { status: 500 });
  }

  return NextResponse.json({
    leaseId,
    leaseDocumentId: doc.id,
    documentType,
    processingStatus: "uploading" as const,
  });
}
