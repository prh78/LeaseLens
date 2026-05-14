import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { parseBearerFromRequest } from "@/lib/auth/bearer";
import { leaseTermStatusFromExpiryDate } from "@/lib/lease/lease-term-status";
import { isPropertyType } from "@/lib/lease/property-types";
import type { Database } from "@/lib/supabase/database.types";
import { getPublicEnv } from "@/lib/env";
import { leaseExtractionStatusConstraintHint } from "@/lib/supabase/lease-schema-errors";

export const dynamic = "force-dynamic";

type CreateLeaseBody = {
  propertyName?: unknown;
  propertyType?: unknown;
};

/**
 * Creates a lease row **before** the PDF is attached (`uploading`).
 * Inserts the primary `lease_documents` row. Client uploads to
 * `{userId}/{leaseId}/{primaryLeaseDocumentId}.pdf` (or legacy `{userId}/{leaseId}.pdf` if the server
 * omits `primaryLeaseDocumentId`), then calls `PATCH /api/v1/leases/:leaseId` with `{ "storagePath": "…" }`
 * to attach and move to `extracting`.
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

  let body: CreateLeaseBody;
  try {
    body = (await request.json()) as CreateLeaseBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const propertyName =
    typeof body.propertyName === "string" ? body.propertyName.trim() : "";
  const propertyType = typeof body.propertyType === "string" ? body.propertyType : "";

  if (!propertyName || propertyName.length > 500) {
    return NextResponse.json({ error: "Property name is required (max 500 characters)." }, { status: 400 });
  }

  if (!isPropertyType(propertyType)) {
    return NextResponse.json({ error: "Invalid property type." }, { status: 400 });
  }

  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceRole) {
    return NextResponse.json(
      {
        error:
          "Server configuration: set SUPABASE_SERVICE_ROLE_KEY in .env.local (Supabase Dashboard → Settings → API → service_role secret).",
      },
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

  const { data, error } = await admin
    .from("leases")
    .insert({
      user_id: user.id,
      property_name: propertyName,
      property_type: propertyType,
      file_url: null,
      extraction_status: "uploading",
    })
    .select("id")
    .single();

  if (error) {
    const hint = leaseExtractionStatusConstraintHint(error);
    return NextResponse.json({ error: hint ?? error.message }, { status: hint ? 503 : 500 });
  }

  const { data: primaryDoc, error: docError } = await admin
    .from("lease_documents")
    .insert({
      lease_id: data.id,
      document_type: "primary_lease",
      file_url: null,
      processing_status: "uploading",
      supersedes_fields: [],
    })
    .select("id")
    .single();

  if (docError || !primaryDoc) {
    await admin.from("leases").delete().eq("id", data.id);
    return NextResponse.json(
      { error: docError?.message ?? "Could not create primary lease document row." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    leaseId: data.id,
    primaryLeaseDocumentId: primaryDoc.id,
    extractionStatus: "uploading" as const,
  });
}

type LeaseListRow = Readonly<{
  id: string;
  property_name: string;
  extraction_status: string;
}>;

/**
 * GET /api/v1/leases — list for supplemental upload picker (id, property_name, extraction_status, term_status,
 * expiry_date).
 */
export async function GET(_request: Request) {
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

  const { data: rows, error } = await admin
    .from("leases")
    .select("id, property_name, extraction_status")
    .eq("user_id", user.id)
    .order("upload_date", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const list = (rows ?? []) as LeaseListRow[];
  const ids = list.map((r) => r.id);

  const expiryByLeaseId = new Map<string, string | null>();
  if (ids.length > 0) {
    const { data: extractedRows, error: exErr } = await admin
      .from("extracted_data")
      .select("lease_id, expiry_date")
      .in("lease_id", ids);

    if (exErr) {
      return NextResponse.json({ error: exErr.message }, { status: 500 });
    }

    for (const row of extractedRows ?? []) {
      const raw = row.expiry_date;
      expiryByLeaseId.set(
        row.lease_id,
        typeof raw === "string" && raw.trim() ? raw.trim() : null,
      );
    }
  }

  const leases = list.map((row) => {
    const expiry_date = expiryByLeaseId.get(row.id) ?? null;
    const term_status = leaseTermStatusFromExpiryDate(expiry_date);
    return {
      id: row.id,
      property_name: row.property_name,
      extraction_status: row.extraction_status,
      term_status,
      expiry_date,
    };
  });

  return NextResponse.json({ leases });
}
