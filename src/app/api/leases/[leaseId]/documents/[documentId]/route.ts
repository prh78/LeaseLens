import { NextResponse } from "next/server";

import { isValidUserLeaseStorageObjectPath } from "@/lib/lease/lease-storage-path";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SIGNED_URL_TTL_SEC = 3600;

type RouteContext = Readonly<{
  params: Promise<{ leaseId: string; documentId: string }>;
}>;

/** Signed URL for any `lease_documents` row (primary or supplemental). */
export async function GET(_request: Request, context: RouteContext) {
  const { leaseId, documentId } = await context.params;

  if (!UUID.test(leaseId) || !UUID.test(documentId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: doc, error: docError } = await supabase
    .from("lease_documents")
    .select("file_url, lease_id")
    .eq("id", documentId)
    .eq("lease_id", leaseId)
    .maybeSingle();

  if (docError) {
    return NextResponse.json({ error: docError.message }, { status: 500 });
  }

  if (!doc?.file_url) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: lease, error: leaseError } = await supabase
    .from("leases")
    .select("id")
    .eq("id", leaseId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (leaseError || !lease) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const path = doc.file_url.trim();
  if (!isValidUserLeaseStorageObjectPath(user.id, leaseId, path)) {
    return NextResponse.json({ error: "Invalid document path" }, { status: 400 });
  }

  const { data: signed, error: signError } = await supabase.storage
    .from("leases")
    .createSignedUrl(path, SIGNED_URL_TTL_SEC);

  if (signError || !signed?.signedUrl) {
    console.error("lease document signed URL:", signError?.message);
    return NextResponse.json({ error: "Could not open document" }, { status: 500 });
  }

  return NextResponse.redirect(signed.signedUrl);
}
