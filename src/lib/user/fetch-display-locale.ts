import { mergeNotificationSettingsFromRow } from "@/lib/notifications/notification-settings";
import { DEFAULT_DISPLAY_LOCALE, normalizeDisplayLocale } from "@/lib/lease/format-app-date";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

/** Loads the user's preferred date display locale (defaults to en-GB). */
export async function fetchDisplayLocaleForUser(
  supabase: Client,
  userId: string,
): Promise<string> {
  const { data: row, error } = await supabase
    .from("user_notification_settings")
    .select("user_id, display_locale, alert_categories, reminder_horizons_days, email_digest_frequency, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("fetchDisplayLocaleForUser:", error.message);
    return DEFAULT_DISPLAY_LOCALE;
  }

  const merged = mergeNotificationSettingsFromRow(row);
  return normalizeDisplayLocale(merged.displayLocale);
}
