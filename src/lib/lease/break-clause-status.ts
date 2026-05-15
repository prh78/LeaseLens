import { parseIsoDateUtc, startOfTodayUtc, utcDateOnlyString } from "@/lib/alerts/date-helpers";
import { jsonStringArray } from "@/lib/lease/lease-detail";
import type { Json } from "@/lib/supabase/database.types";

export const BREAK_CLAUSE_STATUSES = [
  "available",
  "under_review",
  "intend_to_exercise",
  "served",
  "do_not_exercise",
  "expired",
] as const;

export type BreakClauseStatus = (typeof BREAK_CLAUSE_STATUSES)[number];

export const BREAK_CLAUSE_EVIDENCE_TYPES = ["deed_of_surrender", "landlord_confirmation"] as const;

export type BreakClauseEvidenceType = (typeof BREAK_CLAUSE_EVIDENCE_TYPES)[number];

export const BREAK_CLAUSE_STATUS_LABEL: Record<BreakClauseStatus, string> = {
  available: "Available",
  under_review: "Under review",
  intend_to_exercise: "Intend to exercise",
  served: "Served",
  do_not_exercise: "Do not exercise",
  expired: "Expired",
};

export const BREAK_CLAUSE_EVIDENCE_LABEL: Record<BreakClauseEvidenceType, string> = {
  deed_of_surrender: "Deed of surrender",
  landlord_confirmation: "Landlord or agent written confirmation",
};

export type BreakClauseServedDetails = Readonly<{
  notice_served_date: string;
  evidence_type: BreakClauseEvidenceType | null;
  evidence_note: string | null;
}>;

export type BreakClauseEntry = Readonly<{
  status: BreakClauseStatus;
  served: BreakClauseServedDetails | null;
}>;

export function isBreakClauseStatus(value: string): value is BreakClauseStatus {
  return (BREAK_CLAUSE_STATUSES as readonly string[]).includes(value);
}

function isBreakClauseEvidenceType(value: string): value is BreakClauseEvidenceType {
  return (BREAK_CLAUSE_EVIDENCE_TYPES as readonly string[]).includes(value);
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function validBreakDateKey(iso: string): boolean {
  return ISO.test(iso);
}

function validIsoDate(iso: string): boolean {
  return validBreakDateKey(iso);
}

function parseServedDetails(raw: Record<string, unknown>): BreakClauseServedDetails | null {
  const notice = raw.notice_served_date;
  if (typeof notice !== "string" || !validIsoDate(notice)) {
    return null;
  }
  let evidence_type: BreakClauseEvidenceType | null = null;
  if (raw.evidence_type === null || raw.evidence_type === undefined || raw.evidence_type === "") {
    evidence_type = null;
  } else if (typeof raw.evidence_type === "string" && isBreakClauseEvidenceType(raw.evidence_type)) {
    evidence_type = raw.evidence_type;
  }
  const noteRaw = raw.evidence_note;
  const evidence_note =
    typeof noteRaw === "string" && noteRaw.trim().length > 0 ? noteRaw.trim().slice(0, 500) : null;
  return { notice_served_date: notice, evidence_type, evidence_note };
}

function entryFromStoredValue(value: unknown): BreakClauseEntry | null {
  if (typeof value === "string" && isBreakClauseStatus(value)) {
    return { status: value, served: null };
  }
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const raw = value as Record<string, unknown>;
  const status = raw.status;
  if (typeof status !== "string" || !isBreakClauseStatus(status)) {
    return null;
  }
  if (status === "served") {
    const served = parseServedDetails(raw);
    if (!served) {
      return null;
    }
    return { status, served };
  }
  return { status, served: null };
}

function storedValueFromEntry(entry: BreakClauseEntry): string | Record<string, unknown> {
  if (entry.status === "served" && entry.served) {
    return {
      status: entry.status,
      notice_served_date: entry.served.notice_served_date,
      ...(entry.served.evidence_type ? { evidence_type: entry.served.evidence_type } : {}),
      ...(entry.served.evidence_note ? { evidence_note: entry.served.evidence_note } : {}),
    };
  }
  return entry.status;
}

/** Parses persisted `break_clause_status` (ISO break date → status string or entry object). */
export function parseBreakClauseEntryMap(raw: Json | null | undefined): Record<string, BreakClauseEntry> {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const out: Record<string, BreakClauseEntry> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!validBreakDateKey(k)) {
      continue;
    }
    const entry = entryFromStoredValue(v);
    if (entry) {
      out[k] = entry;
    }
  }
  return out;
}

/** Status only (for sorting, alerts, labels). */
export function parseBreakClauseStatusMap(raw: Json | null | undefined): Record<string, BreakClauseStatus> {
  const entries = parseBreakClauseEntryMap(raw);
  const out: Record<string, BreakClauseStatus> = {};
  for (const [k, e] of Object.entries(entries)) {
    out[k] = e.status;
  }
  return out;
}

export function entryForBreakDate(
  breakIso: string,
  entryMap: Readonly<Record<string, BreakClauseEntry>>,
): BreakClauseEntry {
  return entryMap[breakIso] ?? { status: "available", served: null };
}

export function statusForBreakDate(
  breakIso: string,
  statusMap: Readonly<Record<string, BreakClauseStatus>>,
): BreakClauseStatus {
  return statusMap[breakIso] ?? "available";
}

export function servedDetailsForBreakDate(
  breakIso: string,
  entryMap: Readonly<Record<string, BreakClauseEntry>>,
): BreakClauseServedDetails | null {
  const entry = entryMap[breakIso];
  return entry?.status === "served" ? entry.served : null;
}

/**
 * Tenancy end from a served break notice (notice served date + notice period).
 * Returns null when inputs are invalid.
 */
export function tenancyEndFromServedNotice(
  noticeServedDate: string,
  noticePeriodDays: number | null,
): string | null {
  if (!validIsoDate(noticeServedDate)) {
    return null;
  }
  const n =
    noticePeriodDays != null && Number.isFinite(noticePeriodDays)
      ? Math.floor(noticePeriodDays)
      : null;
  if (n != null && n >= 1) {
    const d = parseIsoDateUtc(noticeServedDate);
    if (!d) {
      return null;
    }
    d.setUTCDate(d.getUTCDate() + n);
    return utcDateOnlyString(d);
  }
  return noticeServedDate;
}

/** UTC calendar date (YYYY-MM-DD) for today. */
export function todayUtcIso(): string {
  return utcDateOnlyString(startOfTodayUtc());
}

/**
 * While break notice is intended but not yet served: tenancy end if notice were served today
 * (advances by one calendar day each day until served).
 */
export function projectedTenancyEndIfNoticeServedToday(noticePeriodDays: number | null): string | null {
  return tenancyEndFromServedNotice(todayUtcIso(), noticePeriodDays);
}

export type ExtractedForEffectiveExpiry = Readonly<{
  expiry_date: string | null;
  break_dates: Json;
  break_clause_status?: Json | null;
  notice_period_days: number | null;
}>;

/**
 * When a break is marked served with a notice date, expiry reflects served date + notice period.
 * Otherwise returns the extracted contractual expiry.
 */
export function effectiveExpiryDate(extracted: ExtractedForEffectiveExpiry): string | null {
  const entryMap = parseBreakClauseEntryMap(extracted.break_clause_status ?? null);
  const ends: string[] = [];

  for (const breakIso of breakDatesFromExtracted(extracted.break_dates)) {
    const entry = entryMap[breakIso];
    if (entry?.status !== "served" || !entry.served) {
      continue;
    }
    const end = tenancyEndFromServedNotice(entry.served.notice_served_date, extracted.notice_period_days);
    if (end) {
      ends.push(end);
    }
  }

  if (ends.length > 0) {
    ends.sort();
    return ends[0] ?? null;
  }

  const contractual = extracted.expiry_date;
  return contractual && validIsoDate(contractual) ? contractual : null;
}

export function isExpiryOverriddenByServedNotice(extracted: ExtractedForEffectiveExpiry): boolean {
  const entryMap = parseBreakClauseEntryMap(extracted.break_clause_status ?? null);
  for (const breakIso of breakDatesFromExtracted(extracted.break_dates)) {
    const entry = entryMap[breakIso];
    if (entry?.status === "served" && entry.served) {
      return true;
    }
  }
  return false;
}

/**
 * After extraction/analyse: every `break_dates` entry gets a status; preserve prior choices for dates that still exist.
 */
export function syncBreakClauseStatusWithBreakDates(
  breakDates: readonly string[],
  priorStatusJson: Json | null | undefined,
): Record<string, BreakClauseStatus> {
  const entries = syncBreakClauseEntriesWithBreakDates(breakDates, priorStatusJson);
  const out: Record<string, BreakClauseStatus> = {};
  for (const [k, e] of Object.entries(entries)) {
    out[k] = e.status;
  }
  return out;
}

/** Preserves served metadata when break dates are re-synced after analyse. */
export function syncBreakClauseEntriesWithBreakDates(
  breakDates: readonly string[],
  priorStatusJson: Json | null | undefined,
): Record<string, BreakClauseEntry> {
  const prior = parseBreakClauseEntryMap(priorStatusJson);
  const out: Record<string, BreakClauseEntry> = {};
  const seen = new Set<string>();
  for (const raw of breakDates) {
    if (typeof raw !== "string" || !validBreakDateKey(raw) || seen.has(raw)) {
      continue;
    }
    seen.add(raw);
    const prev = prior[raw];
    out[raw] = prev ?? { status: "available", served: null };
  }
  return out;
}

/** Serialises status map for DB (preserves served objects when provided in prior entries). */
export function serialiseBreakClauseStatusForDb(
  entries: Readonly<Record<string, BreakClauseEntry>>,
): Record<string, string | Record<string, unknown>> {
  const out: Record<string, string | Record<string, unknown>> = {};
  for (const [k, entry] of Object.entries(entries)) {
    out[k] = storedValueFromEntry(entry);
  }
  return out;
}

/** Excluded from next-action lists and scheduled break alerts (archived, declined, or notice served). */
export function isBreakClauseSuppressed(status: BreakClauseStatus | undefined): boolean {
  return status === "do_not_exercise" || status === "expired" || status === "served";
}

/** Break notice-deadline alerts are not scheduled (decision reminders use portfolio metrics only). */
export function isBreakClauseAlertEligible(_status: BreakClauseStatus | undefined): boolean {
  return false;
}

/**
 * @deprecated Prefer {@link isBreakClauseSuppressed} / {@link isBreakClauseAlertEligible} for explicit rules.
 */
export function isBreakClauseActionable(status: BreakClauseStatus | undefined): boolean {
  return !isBreakClauseSuppressed(status);
}

export type BreakClauseEntryPatch = Readonly<{
  status: BreakClauseStatus;
  notice_served_date?: string;
  evidence_type?: BreakClauseEvidenceType | null;
  evidence_note?: string | null;
}>;

function entryFromPatch(patch: BreakClauseEntryPatch): BreakClauseEntry | null {
  if (patch.status === "served") {
    const notice = patch.notice_served_date;
    if (typeof notice !== "string" || !validIsoDate(notice)) {
      return null;
    }
    let evidence_type: BreakClauseEvidenceType | null = null;
    if (patch.evidence_type && isBreakClauseEvidenceType(patch.evidence_type)) {
      evidence_type = patch.evidence_type;
    }
    const evidence_note =
      typeof patch.evidence_note === "string" && patch.evidence_note.trim().length > 0
        ? patch.evidence_note.trim().slice(0, 500)
        : null;
    return {
      status: "served",
      served: { notice_served_date: notice, evidence_type, evidence_note },
    };
  }
  return { status: patch.status, served: null };
}

/** Merges PATCH entries; only keys in `allowedDates` are kept. */
export function mergeBreakClauseEntryPatch(
  current: Readonly<Record<string, BreakClauseEntry>>,
  allowedDates: readonly string[],
  patch: Readonly<Record<string, unknown>>,
): Record<string, BreakClauseEntry> {
  const allowed = new Set(allowedDates.filter((d) => typeof d === "string" && validBreakDateKey(d)));
  const next: Record<string, BreakClauseEntry> = {};
  for (const d of allowed) {
    next[d] = current[d] ?? { status: "available", served: null };
  }
  for (const [k, v] of Object.entries(patch)) {
    if (!allowed.has(k)) {
      continue;
    }
    if (typeof v === "string" && isBreakClauseStatus(v)) {
      next[k] = { status: v, served: null };
      continue;
    }
    if (v == null || typeof v !== "object" || Array.isArray(v)) {
      continue;
    }
    const raw = v as Record<string, unknown>;
    const status = raw.status;
    if (typeof status !== "string" || !isBreakClauseStatus(status)) {
      continue;
    }
    const entry = entryFromPatch({
      status,
      notice_served_date:
        typeof raw.notice_served_date === "string" ? raw.notice_served_date : undefined,
      evidence_type:
        raw.evidence_type === null
          ? null
          : typeof raw.evidence_type === "string" && isBreakClauseEvidenceType(raw.evidence_type)
            ? raw.evidence_type
            : undefined,
      evidence_note: typeof raw.evidence_note === "string" ? raw.evidence_note : undefined,
    });
    if (entry) {
      next[k] = entry;
    }
  }
  return next;
}

/** @deprecated Use {@link mergeBreakClauseEntryPatch}. */
export function mergeBreakClauseStatusPatch(
  current: Readonly<Record<string, BreakClauseStatus>>,
  allowedDates: readonly string[],
  patch: Readonly<Record<string, unknown>>,
): Record<string, BreakClauseStatus> {
  const entryCurrent: Record<string, BreakClauseEntry> = {};
  for (const [k, s] of Object.entries(current)) {
    entryCurrent[k] = { status: s, served: null };
  }
  const merged = mergeBreakClauseEntryPatch(entryCurrent, allowedDates, patch);
  const out: Record<string, BreakClauseStatus> = {};
  for (const [k, e] of Object.entries(merged)) {
    out[k] = e.status;
  }
  return out;
}

export function breakDatesFromExtracted(breakDatesJson: Json): string[] {
  return jsonStringArray(breakDatesJson).filter(validBreakDateKey);
}
