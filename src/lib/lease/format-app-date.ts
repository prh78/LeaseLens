/** BCP 47 locales supported in settings UI. */
export const DISPLAY_LOCALE_OPTIONS = [
  { value: "en-GB", label: "English (UK) — 14 May 2026" },
  { value: "en-US", label: "English (US) — May 14, 2026" },
  { value: "de-DE", label: "German — 14. Mai 2026" },
  { value: "fr-FR", label: "French — 14 mai 2026" },
] as const;

export const DEFAULT_DISPLAY_LOCALE = "en-GB";

const ALLOWED = new Set(DISPLAY_LOCALE_OPTIONS.map((o) => o.value));

export function normalizeDisplayLocale(raw: string | null | undefined): string {
  const t = raw?.trim();
  if (t && ALLOWED.has(t as (typeof DISPLAY_LOCALE_OPTIONS)[number]["value"])) {
    return t;
  }
  return DEFAULT_DISPLAY_LOCALE;
}

/** Formats an ISO calendar date (YYYY-MM-DD) for display in the given locale. */
export function formatAppDate(iso: string | null | undefined, locale: string = DEFAULT_DISPLAY_LOCALE): string | null {
  if (!iso || typeof iso !== "string") {
    return null;
  }
  const d = new Date(`${iso}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    return iso;
  }
  try {
    return d.toLocaleDateString(normalizeDisplayLocale(locale), {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return d.toLocaleDateString(DEFAULT_DISPLAY_LOCALE, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }
}

/** Long-form calendar date for emails and legal-style copy. */
export function formatAppDateLong(iso: string | null | undefined, locale: string = DEFAULT_DISPLAY_LOCALE): string | null {
  if (!iso || typeof iso !== "string") {
    return null;
  }
  const d = new Date(`${iso}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    return iso;
  }
  const loc = normalizeDisplayLocale(locale);
  try {
    return d.toLocaleDateString(loc, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return d.toLocaleDateString(DEFAULT_DISPLAY_LOCALE, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });
  }
}

/** Formats a timestamp for display (upload dates, settings saved-at). */
export function formatAppDateTime(
  isoTimestamp: string | null | undefined,
  locale: string = DEFAULT_DISPLAY_LOCALE,
): string | null {
  if (!isoTimestamp || typeof isoTimestamp !== "string") {
    return null;
  }
  const d = new Date(isoTimestamp);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  const loc = normalizeDisplayLocale(locale);
  try {
    return d.toLocaleString(loc, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return d.toLocaleString(DEFAULT_DISPLAY_LOCALE, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
}
