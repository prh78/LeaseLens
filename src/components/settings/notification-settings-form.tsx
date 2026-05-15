"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { AlertEventKind } from "@/lib/alerts/constants";
import { ALERT_EVENT_KINDS } from "@/lib/alerts/constants";
import { DISPLAY_LOCALE_OPTIONS } from "@/lib/lease/format-app-date";
import {
  EMAIL_DIGEST_OPTIONS,
  REMINDER_HORIZON_OPTIONS,
  type AlertCategoriesState,
} from "@/lib/notifications/notification-settings";
import { formatAppDateTime } from "@/lib/lease/format-app-date";
import type { EmailDigestFrequency } from "@/lib/supabase/database.types";

const CATEGORY_LABEL: Record<AlertEventKind, string> = {
  expiry: "Lease expiry",
  break: "Break option (intend to exercise)",
  rent_review: "Rent review",
};

export type NotificationSettingsFormInitial = Readonly<{
  alertCategories: AlertCategoriesState;
  reminderHorizonsDays: readonly number[];
  emailDigestFrequency: EmailDigestFrequency;
  displayLocale: string;
  updatedAt: string | null;
}>;

type NotificationSettingsFormProps = Readonly<{
  initial: NotificationSettingsFormInitial;
}>;

export function NotificationSettingsForm({ initial }: NotificationSettingsFormProps) {
  const router = useRouter();
  const [alertCategories, setAlertCategories] = useState<AlertCategoriesState>({ ...initial.alertCategories });
  const [horizons, setHorizons] = useState<number[]>(() => [...initial.reminderHorizonsDays]);
  const [digest, setDigest] = useState<EmailDigestFrequency>(initial.emailDigestFrequency);
  const [displayLocale, setDisplayLocale] = useState(initial.displayLocale);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(initial.updatedAt);

  const toggleCategory = (kind: AlertEventKind) => {
    setAlertCategories((prev) => ({ ...prev, [kind]: !prev[kind] }));
  };

  const toggleHorizon = (days: number) => {
    setHorizons((prev) => {
      if (prev.includes(days)) {
        const next = prev.filter((d) => d !== days);
        return next.length > 0 ? next : prev;
      }
      return [...prev, days].sort((a, b) => b - a);
    });
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/me/notification-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alertCategories,
          reminderHorizonsDays: horizons,
          emailDigestFrequency: digest,
          displayLocale,
        }),
      });
      const payload = (await res.json()) as { error?: string; updatedAt?: string | null };
      if (!res.ok) {
        throw new Error(payload.error ?? "Save failed.");
      }
      if (typeof payload.updatedAt === "string") {
        setSavedAt(payload.updatedAt);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Alert categories</h2>
        <p className="text-sm text-slate-600">
          Choose which scheduled lease reminders we create. Instant emails still use your reminder windows below.
        </p>
        <ul className="space-y-2">
          {ALERT_EVENT_KINDS.map((kind) => (
            <li key={kind}>
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-sm transition hover:border-slate-300">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  checked={alertCategories[kind]}
                  onChange={() => toggleCategory(kind)}
                />
                <span className="text-sm font-medium text-slate-900">{CATEGORY_LABEL[kind]}</span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Reminder timing windows</h2>
        <p className="text-sm text-slate-600">
          We schedule one pending alert per selected lead time before each qualifying date. At least one window must stay
          enabled.
        </p>
        <ul className="flex flex-wrap gap-2">
          {REMINDER_HORIZON_OPTIONS.map(({ days, label }) => {
            const checked = horizons.includes(days);
            const sole = horizons.length === 1 && checked;
            return (
              <li key={days}>
                <button
                  type="button"
                  disabled={sole}
                  onClick={() => toggleHorizon(days)}
                  className={[
                    "rounded-lg border px-3 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2",
                    checked
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300",
                    sole ? "cursor-not-allowed opacity-60" : "",
                  ].join(" ")}
                >
                  {label}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Date display format</h2>
        <p className="text-sm text-slate-600">
          How dates appear across your dashboard, lease detail, and exports. Does not change how dates are stored.
        </p>
        <select
          value={displayLocale}
          onChange={(e) => setDisplayLocale(e.target.value)}
          className="max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900"
        >
          {DISPLAY_LOCALE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Email digest frequency</h2>
        <p className="text-sm text-slate-600">
          Portfolio digest cadence for summary emails (delivery is configured with your deployment). Per-lease instant
          alerts are unaffected unless you turn categories off above.
        </p>
        <select
          value={digest}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "off" || v === "daily" || v === "weekly" || v === "monthly") {
              setDigest(v);
            }
          }}
          className="max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900"
        >
          {EMAIL_DIGEST_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </section>

      <div className="flex flex-wrap items-center gap-4 border-t border-slate-200 pt-6">
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        {savedAt ? (
          <p className="text-xs text-slate-500">
            Last saved{" "}
            {formatAppDateTime(savedAt, displayLocale) ?? savedAt}
          </p>
        ) : null}
      </div>
    </div>
  );
}
