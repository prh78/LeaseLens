import { jsonStringArray } from "@/lib/lease/lease-detail";
import type { Json } from "@/lib/supabase/database.types";

type EventKind = "expiry" | "break" | "rent_review";

const KIND_LABEL: Record<EventKind, string> = {
  expiry: "Lease expiry",
  break: "Break option",
  rent_review: "Rent review",
};

/** Lower sorts first when dates tie. */
const KIND_PRIORITY: Record<EventKind, number> = {
  expiry: 0,
  break: 1,
  rent_review: 2,
};

function utcMidnight(y: number, m0: number, d: number): number {
  return Date.UTC(y, m0, d);
}

function parseIsoDateOnly(iso: string): { y: number; m0: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) {
    return null;
  }
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  if (mo < 0 || mo > 11 || d < 1 || d > 31) {
    return null;
  }
  const t = utcMidnight(y, mo, d);
  const check = new Date(t);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo || check.getUTCDate() !== d) {
    return null;
  }
  return { y, m0: mo, d };
}

function calendarDaysFromTodayToEvent(eventIso: string): number | null {
  const parts = parseIsoDateOnly(eventIso);
  if (!parts) {
    return null;
  }
  const now = new Date();
  const today = utcMidnight(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const event = utcMidnight(parts.y, parts.m0, parts.d);
  return Math.round((event - today) / 86_400_000);
}

export type NextCriticalAction = Readonly<{
  label: string;
  daysRemaining: number;
  eventIso: string;
}>;

export function computeNextCriticalAction(extracted: {
  expiry_date: string | null;
  break_dates: Json;
  rent_review_dates: Json;
} | null): NextCriticalAction | null {
  if (!extracted) {
    return null;
  }

  const candidates: { kind: EventKind; iso: string }[] = [];

  if (extracted.expiry_date) {
    candidates.push({ kind: "expiry", iso: extracted.expiry_date });
  }
  for (const iso of jsonStringArray(extracted.break_dates)) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      candidates.push({ kind: "break", iso });
    }
  }
  for (const iso of jsonStringArray(extracted.rent_review_dates)) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      candidates.push({ kind: "rent_review", iso });
    }
  }

  const withDays = candidates
    .map((c) => ({ ...c, days: calendarDaysFromTodayToEvent(c.iso) }))
    .filter((c): c is typeof c & { days: number } => c.days !== null && c.days >= 0);

  if (withDays.length === 0) {
    return null;
  }

  withDays.sort((a, b) => {
    if (a.days !== b.days) {
      return a.days - b.days;
    }
    return KIND_PRIORITY[a.kind] - KIND_PRIORITY[b.kind];
  });

  const best = withDays[0];
  return {
    label: KIND_LABEL[best.kind],
    daysRemaining: best.days,
    eventIso: best.iso,
  };
}

/** True if the lease has at least one milestone in [0, 90] days (inclusive). */
export function hasCriticalActionWithin90Days(extracted: {
  expiry_date: string | null;
  break_dates: Json;
  rent_review_dates: Json;
} | null): boolean {
  const next = computeNextCriticalAction(extracted);
  return next !== null && next.daysRemaining <= 90;
}
