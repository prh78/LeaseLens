import { ALERT_EVENT_KINDS, ALERT_HORIZONS_DAYS, type AlertEventKind } from "@/lib/alerts/constants";
import { DEFAULT_DISPLAY_LOCALE, normalizeDisplayLocale } from "@/lib/lease/format-app-date";
import type { EmailDigestFrequency, Json, Tables } from "@/lib/supabase/database.types";

export type UserNotificationSettingsRow = Tables<"user_notification_settings">;

export type AlertCategoriesState = Readonly<Record<AlertEventKind, boolean>>;

const DEFAULT_CATEGORIES: AlertCategoriesState = {
  expiry: true,
  break: true,
  rent_review: true,
};

const DEFAULT_DIGEST: EmailDigestFrequency = "off";

export const EMAIL_DIGEST_OPTIONS: readonly { value: EmailDigestFrequency; label: string }[] = [
  { value: "off", label: "Off — no portfolio digest" },
  { value: "daily", label: "Daily summary" },
  { value: "weekly", label: "Weekly summary" },
  { value: "monthly", label: "Monthly summary" },
];

export const REMINDER_HORIZON_OPTIONS: readonly { days: number; label: string }[] = [
  { days: 180, label: "180 days before" },
  { days: 90, label: "90 days before" },
  { days: 30, label: "30 days before" },
  { days: 7, label: "7 days before" },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

export function parseAlertCategoriesJson(raw: Json | null | undefined): AlertCategoriesState {
  if (!isRecord(raw)) {
    return { ...DEFAULT_CATEGORIES };
  }
  const out: Record<AlertEventKind, boolean> = { ...DEFAULT_CATEGORIES };
  for (const kind of ALERT_EVENT_KINDS) {
    const v = raw[kind];
    if (typeof v === "boolean") {
      out[kind] = v;
    }
  }
  return out;
}

export function normalizeReminderHorizons(raw: unknown): number[] {
  if (!Array.isArray(raw)) {
    return [...ALERT_HORIZONS_DAYS];
  }
  const allowed = new Set<number>(ALERT_HORIZONS_DAYS as readonly number[]);
  const picked = raw
    .map((n) => (typeof n === "number" && Number.isInteger(n) ? n : Number.parseInt(String(n), 10)))
    .filter((n) => Number.isFinite(n) && allowed.has(n));
  const unique = [...new Set(picked)].sort((a, b) => b - a);
  return unique.length > 0 ? unique : [...ALERT_HORIZONS_DAYS];
}

export function isEmailDigestFrequency(v: string): v is EmailDigestFrequency {
  return v === "off" || v === "daily" || v === "weekly" || v === "monthly";
}

export function mergeNotificationSettingsFromRow(
  row: UserNotificationSettingsRow | null,
): {
  alertCategories: AlertCategoriesState;
  reminderHorizonsDays: number[];
  emailDigestFrequency: EmailDigestFrequency;
  displayLocale: string;
  updatedAt: string | null;
} {
  if (!row) {
    return {
      alertCategories: { ...DEFAULT_CATEGORIES },
      reminderHorizonsDays: [...ALERT_HORIZONS_DAYS],
      emailDigestFrequency: DEFAULT_DIGEST,
      displayLocale: DEFAULT_DISPLAY_LOCALE,
      updatedAt: null,
    };
  }
  return {
    alertCategories: parseAlertCategoriesJson(row.alert_categories),
    reminderHorizonsDays: normalizeReminderHorizons(row.reminder_horizons_days),
    emailDigestFrequency: isEmailDigestFrequency(row.email_digest_frequency)
      ? row.email_digest_frequency
      : DEFAULT_DIGEST,
    displayLocale: normalizeDisplayLocale(row.display_locale),
    updatedAt: row.updated_at,
  };
}

export function isAlertCategoryEnabled(kind: AlertEventKind, categories: AlertCategoriesState): boolean {
  return categories[kind] === true;
}

/** Horizons to use when inserting lease alerts (intersection with global allowlist, descending). */
export function effectiveReminderHorizonsDays(horizons: readonly number[]): number[] {
  const allowed = new Set<number>(ALERT_HORIZONS_DAYS as readonly number[]);
  return [...new Set(horizons.filter((d) => allowed.has(d)))].sort((a, b) => b - a);
}
