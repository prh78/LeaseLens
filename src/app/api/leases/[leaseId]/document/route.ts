import { NextResponse } from "next/server";

import { isValidLeasePdfStoragePath } from "@/lib/lease/lease-storage-path";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const LEASE_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SIGNED_URL_TTL_SEC = 3600;

type RouteContext = Readonly<{
  params: Promise<{ leaseId: string }>;
}>;

export async function GET(_request: Request, context: RouteContext) {
  const { leaseId } = await context.params;

  if (!LEASE_ID_RE.test(leaseId)) {
    return NextResponse.json({ error: "Invalid lease id" }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: lease, error: leaseError } = await supabase
    .from("leases")
    .select("file_url")
    .eq("id", leaseId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (leaseError || !lease?.file_url) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!isValidLeasePdfStoragePath(user.id, leaseId, lease.file_url)) {
    return NextResponse.json({ error: "Invalid document path" }, { status: 400 });
  }

  const { data: signed, error: signError } = await supabase.storage
    .from("leases")
    .createSignedUrl(lease.file_url, SIGNED_URL_TTL_SEC);

  if (signError || !signed?.signedUrl) {
    console.error("lease document signed URL:", signError?.message);
    return NextResponse.json({ error: "Could not open document" }, { status: 500 });
  }

  return NextResponse.redirect(signed.signedUrl);
}
