import type { SupabaseClient } from "@supabase/supabase-js";

import type { AlertEventKind } from "@/lib/alerts/constants";
import { parseIsoDateUtc, startOfTodayUtc, triggerAtForHorizon, utcDateOnlyString } from "@/lib/alerts/date-helpers";
import {
  effectiveReminderHorizonsDays,
  isAlertCategoryEnabled,
  mergeNotificationSettingsFromRow,
} from "@/lib/notifications/notification-settings";
import {
  isBreakClauseAlertEligible,
  parseBreakClauseStatusMap,
  statusForBreakDate,
} from "@/lib/lease/break-clause-status";
import { breakNoticeDeadlineIso } from "@/lib/lease/compute-lease-next-action";
import type { Database, Json } from "@/lib/supabase/database.types";

type Admin = SupabaseClient<Database>;

function jsonStringArray(value: Json): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((v): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v));
}

function eventLabel(kind: AlertEventKind, horizon: number): string {
  switch (kind) {
    case "expiry":
      return `Lease expiry — ${horizon} days before`;
    case "break":
      return `Break option — ${horizon} days before`;
    case "rent_review":
      return `Rent review — ${horizon} days before`;
    default:
      return `Lease reminder — ${horizon} days before`;
  }
}

function collectEventDates(extracted: {
  expiry_date: string | null;
  break_dates: Json;
  break_clause_status?: Json | null;
  notice_period_days: number | null;
  rent_review_dates: Json;
}): { kind: AlertEventKind; iso: string }[] {
  const out: { kind: AlertEventKind; iso: string }[] = [];
  const seen = new Set<string>();
  const breakStatusMap = parseBreakClauseStatusMap(extracted.break_clause_status ?? null);

  const push = (kind: AlertEventKind, iso: string) => {
    const key = `${kind}:${iso}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    out.push({ kind, iso });
  };

  if (extracted.expiry_date) {
    push("expiry", extracted.expiry_date);
  }
  for (const iso of jsonStringArray(extracted.break_dates)) {
    if (!isBreakClauseAlertEligible(statusForBreakDate(iso, breakStatusMap))) {
      continue;
    }
    const alertIso = breakNoticeDeadlineIso(iso, extracted.notice_period_days) ?? iso;
    push("break", alertIso);
  }
  for (const iso of jsonStringArray(extracted.rent_review_dates)) {
    push("rent_review", iso);
  }

  return out;
}

/**
 * Rebuilds future pending alert rows for a lease from structured `extracted_data`.
 * Does not delete rows that were already sent.
 */
export async function syncLeaseAlerts(admin: Admin, leaseId: string): Promise<{ inserted: number }> {
  const { data: lease, error: leaseErr } = await admin
    .from("leases")
    .select("id, extraction_status, user_id")
    .eq("id", leaseId)
    .maybeSingle();

  if (leaseErr || !lease || (lease.extraction_status !== "complete" && lease.extraction_status !== "calculating_risks")) {
    await admin.from("alerts").delete().eq("lease_id", leaseId).in("sent_status", ["pending", "skipped"]);
    return { inserted: 0 };
  }

  const { data: settingsRow } = await admin
    .from("user_notification_settings")
    .select("*")
    .eq("user_id", lease.user_id)
    .maybeSingle();

  const prefs = mergeNotificationSettingsFromRow(settingsRow);
  const horizons = effectiveReminderHorizonsDays(prefs.reminderHorizonsDays);

  const { data: extracted, error: exErr } = await admin.from("extracted_data").select("*").eq("lease_id", leaseId).maybeSingle();

  if (exErr || !extracted) {
    await admin.from("alerts").delete().eq("lease_id", leaseId).in("sent_status", ["pending", "skipped"]);
    return { inserted: 0 };
  }

  await admin.from("alerts").delete().eq("lease_id", leaseId).in("sent_status", ["pending", "skipped"]);

  const today = startOfTodayUtc();
  const events = collectEventDates(extracted);
  const rows: {
    lease_id: string;
    alert_type: string;
    trigger_date: string;
    sent_status: "pending";
    event_kind: AlertEventKind;
    event_date: string;
    horizon_days: number;
  }[] = [];

  for (const { kind, iso } of events) {
    if (!isAlertCategoryEnabled(kind, prefs.alertCategories)) {
      continue;
    }
    const eventDay = parseIsoDateUtc(iso);
    if (!eventDay) {
      continue;
    }
    if (eventDay.getTime() < today.getTime()) {
      continue;
    }

    for (const horizon of horizons) {
      const trigger = triggerAtForHorizon(eventDay, horizon);
      const now = new Date();
      if (trigger.getTime() < now.getTime()) {
        continue;
      }

      rows.push({
        lease_id: leaseId,
        alert_type: eventLabel(kind, horizon),
        trigger_date: trigger.toISOString(),
        sent_status: "pending",
        event_kind: kind,
        event_date: utcDateOnlyString(eventDay),
        horizon_days: horizon,
      });
    }
  }

  if (rows.length === 0) {
    return { inserted: 0 };
  }

  const { error: insErr } = await admin.from("alerts").insert(rows);
  if (insErr) {
    throw new Error(insErr.message);
  }

  return { inserted: rows.length };
}
