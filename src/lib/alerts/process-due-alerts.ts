import type { SupabaseClient } from "@supabase/supabase-js";

import { isAlertEventKind } from "@/lib/alerts/constants";
import { leaseDetailUrl, portfolioDashboardUrl, sendLeaseAlertEmail } from "@/lib/alerts/send-lease-alert-email";
import type { Database } from "@/lib/supabase/database.types";

type Admin = SupabaseClient<Database>;

function formatDeadlineLabel(eventDateIso: string): string {
  const d = new Date(`${eventDateIso}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    return eventDateIso;
  }
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export type ProcessDueAlertsSummary = Readonly<{
  scanned: number;
  sent: number;
  failed: number;
  skippedNoEmail: number;
}>;

/**
 * Sends emails for due pending alerts and updates `sent_status`.
 */
export async function processDueAlerts(admin: Admin, options?: { limit?: number }): Promise<ProcessDueAlertsSummary> {
  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 200);
  const nowIso = new Date().toISOString();

  const { data: due, error: qErr } = await admin
    .from("alerts")
    .select("id, lease_id, trigger_date, event_kind, event_date, horizon_days")
    .eq("sent_status", "pending")
    .lte("trigger_date", nowIso)
    .order("trigger_date", { ascending: true })
    .limit(limit);

  if (qErr || !due?.length) {
    return { scanned: 0, sent: 0, failed: 0, skippedNoEmail: 0 };
  }

  let sent = 0;
  let failed = 0;
  let skippedNoEmail = 0;

  for (const row of due) {
    if (!row.event_kind || !row.event_date || row.horizon_days == null) {
      await admin.from("alerts").update({ sent_status: "skipped" }).eq("id", row.id);
      continue;
    }

    if (!isAlertEventKind(row.event_kind)) {
      await admin.from("alerts").update({ sent_status: "skipped" }).eq("id", row.id);
      continue;
    }

    const { data: lease, error: lErr } = await admin
      .from("leases")
      .select("id, property_name, user_id")
      .eq("id", row.lease_id)
      .maybeSingle();

    if (lErr || !lease) {
      await admin.from("alerts").update({ sent_status: "failed" }).eq("id", row.id);
      failed += 1;
      continue;
    }

    const { data: userRes, error: uErr } = await admin.auth.admin.getUserById(lease.user_id);
    const email = userRes.user?.email?.trim();

    if (uErr || !email) {
      skippedNoEmail += 1;
      await admin.from("alerts").update({ sent_status: "skipped" }).eq("id", row.id);
      continue;
    }

    const kind = row.event_kind;
    const payload = {
      propertyName: lease.property_name,
      eventKind: kind,
      horizonDays: row.horizon_days,
      eventDateIso: row.event_date,
      actionDeadlineLabel: formatDeadlineLabel(row.event_date),
      dashboardUrl: portfolioDashboardUrl(),
      leaseDetailUrl: leaseDetailUrl(lease.id),
    };

    const mail = await sendLeaseAlertEmail(email, payload);
    if (!mail.ok) {
      failed += 1;
      await admin.from("alerts").update({ sent_status: "failed" }).eq("id", row.id);
      continue;
    }

    await admin.from("alerts").update({ sent_status: "sent" }).eq("id", row.id);
    sent += 1;
  }

  return { scanned: due.length, sent, failed, skippedNoEmail };
}
