import { NextResponse } from "next/server";

import { isPropertyType } from "@/lib/lease/property-types";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const STORAGE_PATH = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.pdf$/i;

function isValidLeaseObjectPath(userId: string, storagePath: string): boolean {
  const segments = storagePath.split("/").filter(Boolean);
  if (segments.length !== 2) {
    return false;
  }
  if (segments[0] !== userId) {
    return false;
  }
  return STORAGE_PATH.test(segments[1]);
}

type CreateLeaseBody = {
  propertyName?: unknown;
  propertyType?: unknown;
  storagePath?: unknown;
};

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
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
  const storagePath = typeof body.storagePath === "string" ? body.storagePath.trim() : "";

  if (!propertyName || propertyName.length > 500) {
    return NextResponse.json({ error: "Property name is required (max 500 characters)." }, { status: 400 });
  }

  if (!isPropertyType(propertyType)) {
    return NextResponse.json({ error: "Invalid property type." }, { status: 400 });
  }

  if (!storagePath || !isValidLeaseObjectPath(user.id, storagePath)) {
    return NextResponse.json({ error: "Invalid storage path." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("leases")
    .insert({
      user_id: user.id,
      property_name: propertyName,
      property_type: propertyType,
      file_url: storagePath,
      extraction_status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ leaseId: data.id });
}
