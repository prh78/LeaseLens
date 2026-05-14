import { NextResponse } from "next/server";

import {
  isEmailDigestFrequency,
  mergeNotificationSettingsFromRow,
  normalizeReminderHorizons,
  parseAlertCategoriesJson,
} from "@/lib/notifications/notification-settings";
import type { EmailDigestFrequency, Json } from "@/lib/supabase/database.types";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PatchBody = Readonly<{
  alertCategories?: unknown;
  reminderHorizonsDays?: unknown;
  emailDigestFrequency?: unknown;
}>;

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: row, error } = await supabase
    .from("user_notification_settings")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const merged = mergeNotificationSettingsFromRow(row);
  return NextResponse.json(merged);
}

export async function PATCH(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { data: existing, error: readErr } = await supabase
    .from("user_notification_settings")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (readErr) {
    return NextResponse.json({ error: readErr.message }, { status: 500 });
  }

  const current = mergeNotificationSettingsFromRow(existing);

  let alertCategories = current.alertCategories;
  if (body.alertCategories != null) {
    if (typeof body.alertCategories !== "object" || body.alertCategories === null || Array.isArray(body.alertCategories)) {
      return NextResponse.json({ error: "alertCategories must be an object." }, { status: 400 });
    }
    alertCategories = parseAlertCategoriesJson(body.alertCategories as Json);
  }

  let reminderHorizonsDays = current.reminderHorizonsDays;
  if (body.reminderHorizonsDays != null) {
    reminderHorizonsDays = normalizeReminderHorizons(body.reminderHorizonsDays);
  }

  let emailDigestFrequency: EmailDigestFrequency = current.emailDigestFrequency;
  if (body.emailDigestFrequency != null) {
    if (typeof body.emailDigestFrequency !== "string" || !isEmailDigestFrequency(body.emailDigestFrequency)) {
      return NextResponse.json({ error: "Invalid emailDigestFrequency." }, { status: 400 });
    }
    emailDigestFrequency = body.emailDigestFrequency;
  }

  const alert_categories = alertCategories as unknown as Json;

  const { data: saved, error: upsertErr } = await supabase
    .from("user_notification_settings")
    .upsert(
      {
        user_id: user.id,
        alert_categories,
        reminder_horizons_days: reminderHorizonsDays,
        email_digest_frequency: emailDigestFrequency,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )
    .select("*")
    .single();

  if (upsertErr || !saved) {
    return NextResponse.json({ error: upsertErr?.message ?? "Save failed." }, { status: 500 });
  }

  return NextResponse.json(mergeNotificationSettingsFromRow(saved));
}
