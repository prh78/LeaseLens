/**
 * Parse YYYY-MM-DD into a UTC midnight timestamp for calendar arithmetic.
 */
export function parseIsoDateUtc(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) {
    return null;
  }
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) {
    return null;
  }
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (Number.isNaN(dt.getTime())) {
    return null;
  }
  return dt;
}

export function utcDateOnlyString(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Calendar day that is `daysBefore` days before `eventUtc` (UTC date components).
 * Then set 09:00 UTC as the moment the reminder becomes due for batch jobs.
 */
export function triggerAtForHorizon(eventUtc: Date, daysBefore: number): Date {
  const t = new Date(eventUtc.getTime());
  t.setUTCDate(t.getUTCDate() - daysBefore);
  t.setUTCHours(9, 0, 0, 0);
  return t;
}

export function startOfTodayUtc(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate(), 0, 0, 0, 0));
}
