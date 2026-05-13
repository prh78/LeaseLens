import { buildLeaseAlertHtml, buildLeaseAlertPlainText, buildLeaseAlertSubject } from "@/lib/alerts/email-template";
import type { LeaseAlertEmailPayload } from "@/lib/alerts/email-template";

type ResendEmailResponse = {
  id?: string;
  message?: string;
};

function getAppBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    return `https://${vercel.replace(/\/$/, "")}`;
  }
  return "http://localhost:3000";
}

export function portfolioDashboardUrl(): string {
  return `${getAppBaseUrl()}/dashboard`;
}

export function leaseDetailUrl(leaseId: string): string {
  return `${getAppBaseUrl()}/lease/${leaseId}`;
}

export async function sendLeaseAlertEmail(
  to: string,
  payload: LeaseAlertEmailPayload,
): Promise<{ ok: true; id?: string } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim() || "LeaseLens <onboarding@resend.dev>";

  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY is not configured." };
  }

  const subject = buildLeaseAlertSubject(payload);
  const html = buildLeaseAlertHtml(payload);
  const text = buildLeaseAlertPlainText(payload);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
      text,
    }),
  });

  const body = (await res.json().catch(() => ({}))) as ResendEmailResponse & { message?: string };

  if (!res.ok) {
    const msg = typeof body.message === "string" ? body.message : `Resend HTTP ${res.status}`;
    return { ok: false, error: msg };
  }

  return { ok: true, id: body.id };
}
