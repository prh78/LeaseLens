import { jsonStringArray } from "@/lib/lease/lease-detail";
import type { Json } from "@/lib/supabase/database.types";

export const BREAK_CLAUSE_STATUSES = [
  "available",
  "under_review",
  "intend_to_exercise",
  "do_not_exercise",
  "expired",
] as const;

export type BreakClauseStatus = (typeof BREAK_CLAUSE_STATUSES)[number];

export const BREAK_CLAUSE_STATUS_LABEL: Record<BreakClauseStatus, string> = {
  available: "Available",
  under_review: "Under review",
  intend_to_exercise: "Intend to exercise",
  do_not_exercise: "Do not exercise",
  expired: "Expired",
};

export function isBreakClauseStatus(value: string): value is BreakClauseStatus {
  return (BREAK_CLAUSE_STATUSES as readonly string[]).includes(value);
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function validBreakDateKey(iso: string): boolean {
  return ISO.test(iso);
}

/** Parses persisted `break_clause_status` object (ISO date -> status string). */
export function parseBreakClauseStatusMap(raw: Json | null | undefined): Record<string, BreakClauseStatus> {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const out: Record<string, BreakClauseStatus> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!validBreakDateKey(k)) {
      continue;
    }
    if (typeof v === "string" && isBreakClauseStatus(v)) {
      out[k] = v;
    }
  }
  return out;
}

/**
 * After extraction/analyse: every `break_dates` entry gets a status; preserve prior choices for dates that still exist.
 */
export function syncBreakClauseStatusWithBreakDates(
  breakDates: readonly string[],
  priorStatusJson: Json | null | undefined,
): Record<string, BreakClauseStatus> {
  const prior = parseBreakClauseStatusMap(priorStatusJson);
  const out: Record<string, BreakClauseStatus> = {};
  const seen = new Set<string>();
  for (const raw of breakDates) {
    if (typeof raw !== "string" || !validBreakDateKey(raw) || seen.has(raw)) {
      continue;
    }
    seen.add(raw);
    const prev = prior[raw];
    out[raw] = prev ?? "available";
  }
  return out;
}

/** Excluded from next-action lists and scheduled break alerts (archived or declined). */
export function isBreakClauseSuppressed(status: BreakClauseStatus | undefined): boolean {
  return status === "do_not_exercise" || status === "expired";
}

/** Only committed exercise drives scheduled break alerts (notice-deadline horizons). */
export function isBreakClauseAlertEligible(status: BreakClauseStatus | undefined): boolean {
  return status === "intend_to_exercise";
}

/**
 * @deprecated Prefer {@link isBreakClauseSuppressed} / {@link isBreakClauseAlertEligible} for explicit rules.
 * Legacy: breaks that were not fully suppressed from tier-1 date lists.
 */
export function isBreakClauseActionable(status: BreakClauseStatus | undefined): boolean {
  return !isBreakClauseSuppressed(status);
}

export function statusForBreakDate(
  breakIso: string,
  statusMap: Readonly<Record<string, BreakClauseStatus>>,
): BreakClauseStatus {
  return statusMap[breakIso] ?? "available";
}

/** Merges a partial PATCH of statuses; only keys in `allowedDates` are kept; invalid values ignored. */
export function mergeBreakClauseStatusPatch(
  current: Readonly<Record<string, BreakClauseStatus>>,
  allowedDates: readonly string[],
  patch: Readonly<Record<string, unknown>>,
): Record<string, BreakClauseStatus> {
  const allowed = new Set(allowedDates.filter((d) => typeof d === "string" && validBreakDateKey(d)));
  const next: Record<string, BreakClauseStatus> = {};
  for (const d of allowed) {
    next[d] = current[d] ?? "available";
  }
  for (const [k, v] of Object.entries(patch)) {
    if (!allowed.has(k) || typeof v !== "string" || !isBreakClauseStatus(v)) {
      continue;
    }
    next[k] = v;
  }
  return next;
}

export function breakDatesFromExtracted(breakDatesJson: Json): string[] {
  return jsonStringArray(breakDatesJson).filter(validBreakDateKey);
}
