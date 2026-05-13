import type { AlertEventKind } from "@/lib/alerts/constants";

export type LeaseAlertEmailPayload = Readonly<{
  propertyName: string;
  eventKind: AlertEventKind;
  horizonDays: number;
  /** ISO date YYYY-MM-DD of the lease milestone */
  eventDateIso: string;
  /** When the user should act by (same as event for clarity, formatted for humans) */
  actionDeadlineLabel: string;
  /** Portfolio overview */
  dashboardUrl: string;
  /** Direct link to this lease */
  leaseDetailUrl: string;
}>;

function eventTypeLabel(kind: AlertEventKind): string {
  switch (kind) {
    case "expiry":
      return "Lease expiry";
    case "break":
      return "Break option";
    case "rent_review":
      return "Rent review";
    default:
      return "Lease milestone";
  }
}

function subjectLine(payload: LeaseAlertEmailPayload): string {
  const type = eventTypeLabel(payload.eventKind);
  return `${payload.propertyName} — ${type} in ${payload.horizonDays} days`;
}

function formatLongDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    return iso;
  }
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function buildLeaseAlertPlainText(payload: LeaseAlertEmailPayload): string {
  const type = eventTypeLabel(payload.eventKind);
  const lines = [
    `LeaseLens reminder`,
    ``,
    `Property: ${payload.propertyName}`,
    `Event: ${type}`,
    `Milestone date: ${formatLongDate(payload.eventDateIso)}`,
    `Reminder window: ${payload.horizonDays} days before that date`,
    `Action deadline: ${payload.actionDeadlineLabel}`,
    ``,
    `Open your dashboard:`,
    payload.dashboardUrl,
    ``,
    `View this lease:`,
    payload.leaseDetailUrl,
    ``,
    `This is an automated message. Please verify all dates against your signed lease.`,
  ];
  return lines.join("\n");
}

export function buildLeaseAlertHtml(payload: LeaseAlertEmailPayload): string {
  const type = eventTypeLabel(payload.eventKind);
  const escaped = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escaped(subjectLine(payload))}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f1f5f9;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:520px;background-color:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
          <tr>
            <td style="padding:24px 28px 8px 28px;">
              <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">LeaseLens</p>
              <h1 style="margin:12px 0 0 0;font-size:20px;font-weight:600;color:#0f172a;line-height:1.3;">Lease date reminder</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 24px 28px;">
              <table role="presentation" width="100%" style="border-collapse:collapse;font-size:15px;color:#334155;line-height:1.5;">
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;color:#64748b;width:38%;">Property</td>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-weight:600;color:#0f172a;">${escaped(payload.propertyName)}</td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;color:#64748b;">Event type</td>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-weight:600;color:#0f172a;">${escaped(type)}</td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;color:#64748b;">Milestone date</td>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-weight:600;color:#0f172a;">${escaped(formatLongDate(payload.eventDateIso))}</td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;color:#64748b;">Reminder</td>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">${payload.horizonDays} days before milestone</td>
                </tr>
                <tr>
                  <td style="padding:10px 0;color:#64748b;vertical-align:top;">Action deadline</td>
                  <td style="padding:10px 0;font-weight:600;color:#0f172a;">${escaped(payload.actionDeadlineLabel)}</td>
                </tr>
              </table>
              <p style="margin:24px 0 0 0;font-size:13px;color:#64748b;">Verify all dates against your signed lease before taking action.</p>
              <a href="${escaped(payload.dashboardUrl)}" style="display:inline-block;margin-top:20px;padding:12px 20px;background-color:#0f172a;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;border-radius:8px;">Open dashboard</a>
              <p style="margin:16px 0 0 0;font-size:14px;">
                <a href="${escaped(payload.leaseDetailUrl)}" style="color:#2563eb;font-weight:600;text-decoration:underline;">View this lease</a>
              </p>
            </td>
          </tr>
        </table>
        <p style="margin:16px 0 0 0;font-size:11px;color:#94a3b8;">You received this because this lease is in your LeaseLens portfolio.</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export { subjectLine as buildLeaseAlertSubject };
