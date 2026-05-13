import type { TablesInsert } from "@/lib/supabase/database.types";
import type { LeaseLensBrowserClient } from "@/lib/supabase/client";
import type { LeaseLensServerClient } from "@/lib/supabase/server";

/**
 * Typed query helpers for LeaseLens tables. Pass a client from
 * `createClient()` (browser) or `createServerSupabaseClient()` (server).
 */

type AnyLeaseLensClient = LeaseLensBrowserClient | LeaseLensServerClient;

export async function listLeasesForUser(client: AnyLeaseLensClient, userId: string) {
  return client.from("leases").select("*").eq("user_id", userId).order("upload_date", { ascending: false });
}

export async function getLeaseById(client: AnyLeaseLensClient, leaseId: string) {
  return client.from("leases").select("*").eq("id", leaseId).maybeSingle();
}

export async function insertLease(client: AnyLeaseLensClient, row: TablesInsert<"leases">) {
  return client.from("leases").insert(row).select().single();
}

export async function getExtractedDataForLease(client: AnyLeaseLensClient, leaseId: string) {
  return client.from("extracted_data").select("*").eq("lease_id", leaseId).maybeSingle();
}

export async function upsertExtractedData(client: AnyLeaseLensClient, row: TablesInsert<"extracted_data">) {
  return client.from("extracted_data").upsert(row, { onConflict: "lease_id" }).select().single();
}

export async function listAlertsForLease(client: AnyLeaseLensClient, leaseId: string) {
  return client.from("alerts").select("*").eq("lease_id", leaseId).order("trigger_date", { ascending: true });
}

export async function insertAlert(client: AnyLeaseLensClient, row: TablesInsert<"alerts">) {
  return client.from("alerts").insert(row).select().single();
}
