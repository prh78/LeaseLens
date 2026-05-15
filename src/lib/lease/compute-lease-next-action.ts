import { parseIsoDateUtc, utcDateOnlyString } from "@/lib/alerts/date-helpers";
import {
  effectiveExpiryDate,
  isBreakClauseSuppressed,
  parseBreakClauseStatusMap,
  projectedTenancyEndIfNoticeServedToday,
  statusForBreakDate,
} from "@/lib/lease/break-clause-status";
import { DEFAULT_DISPLAY_LOCALE, formatAppDate } from "@/lib/lease/format-app-date";
import { jsonStringArray } from "@/lib/lease/lease-detail";
import type { Json, LeaseNextActionType, LeaseNextActionUrgency } from "@/lib/supabase/database.types";

export type { LeaseNextActionType, LeaseNextActionUrgency } from "@/lib/supabase/database.types";

/** How a break row contributes to portfolio “critical” metrics and copy. */
export type BreakClauseNextTier = "decision_reminder" | "intend_projected_end";

export type LeaseNextActionResult = Readonly<{
  action_type: LeaseNextActionType;
  action_date: string | null;
  days_remaining: number | null;
  urgency_level: LeaseNextActionUrgency;
  /** When false, excluded from “critical actions due” metrics. Omitted means true. */
  counts_toward_critical?: boolean;
  /** Present when `action_type` is `break_notice_deadline` and the row comes from a dated break. */
  break_clause_tier?: BreakClauseNextTier;
  /**
   * First calendar date the break option may be exercised (break date minus notice period).
   * Not a due date — used for decision reminders only.
   */
  break_available_from?: string | null;
}>;

export const LEASE_NEXT_ACTION_LABEL: Record<LeaseNextActionType, string> = {
  break_notice_deadline: "Break notice deadline",
  rent_review: "Rent review",
  lease_expiry: "Lease expiry",
  manual_review: "Manual review required",
};

/** Primary label for UI and exports; varies by break clause decision tier when applicable. */
export function nextActionDisplayLabel(next: LeaseNextActionResult): string {
  if (next.action_type !== "break_notice_deadline" || next.break_clause_tier == null) {
    return LEASE_NEXT_ACTION_LABEL[next.action_type];
  }
  if (next.break_clause_tier === "decision_reminder") {
    return "Break decision reminder";
  }
  if (next.break_clause_tier === "intend_projected_end") {
    return "Projected tenancy end";
  }
  return LEASE_NEXT_ACTION_LABEL.break_notice_deadline;
}

export type ExtractedForNextAction = Readonly<{
  expiry_date: string | null;
  break_dates: Json;
  break_clause_status?: Json | null;
  notice_period_days: number | null;
  rent_review_dates: Json;
  ambiguous_language: boolean | null;
  manual_review_recommended: boolean | null;
}>;

export function calendarDaysRemaining(iso: string): number | null {
  const event = parseIsoDateUtc(iso);
  if (!event) {
    return null;
  }
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const eventUtc = Date.UTC(event.getUTCFullYear(), event.getUTCMonth(), event.getUTCDate());
  return Math.round((eventUtc - todayUtc) / 86_400_000);
}

function subtractCalendarDays(iso: string, days: number): string | null {
  const d = parseIsoDateUtc(iso);
  if (!d || days < 1) {
    return null;
  }
  d.setUTCDate(d.getUTCDate() - days);
  return utcDateOnlyString(d);
}

export function addCalendarDays(iso: string, days: number): string | null {
  const d = parseIsoDateUtc(iso);
  if (!d || days < 1) {
    return null;
  }
  d.setUTCDate(d.getUTCDate() + days);
  return utcDateOnlyString(d);
}

function validDateIso(iso: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && parseIsoDateUtc(iso) !== null;
}

function bestIsoInTier(isos: string[]): { iso: string; days: number } | null {
  let best: { iso: string; days: number } | null = null;
  for (const iso of isos) {
    if (!validDateIso(iso)) {
      continue;
    }
    const days = calendarDaysRemaining(iso);
    if (days === null) {
      continue;
    }
    if (!best || days < best.days) {
      best = { iso, days };
    }
  }
  return best;
}

function noticeDays(value: number | null): number | null {
  if (value == null || !Number.isFinite(value)) {
    return null;
  }
  const n = Math.floor(value);
  return n >= 1 ? n : null;
}

/**
 * Last calendar day to serve break notice to exercise on `breakIso` (break date minus notice period),
 * or the break date when no notice period is recorded.
 */
export function breakNoticeDeadlineIso(breakIso: string, noticePeriodDays: number | null): string | null {
  if (!validDateIso(breakIso)) {
    return null;
  }
  const n = noticeDays(noticePeriodDays);
  if (n !== null) {
    return subtractCalendarDays(breakIso, n) ?? breakIso;
  }
  return breakIso;
}

/** First date the break option may be exercised (same calendar rule as notice deadline). */
export function breakWindowOpensIso(breakIso: string, noticePeriodDays: number | null): string | null {
  return breakNoticeDeadlineIso(breakIso, noticePeriodDays);
}

/** Portfolio / detail copy when a break is a decision reminder (no due date). */
export function formatBreakAvailableFromLabel(
  availableFromIso: string,
  locale: string = DEFAULT_DISPLAY_LOCALE,
): string {
  const days = calendarDaysRemaining(availableFromIso);
  const label = formatAppDate(availableFromIso, locale) ?? availableFromIso;
  if (days === null) {
    return `Available from ${label}`;
  }
  if (days > 0) {
    return `Available from ${label}`;
  }
  return "Break window open";
}

function capUrgency(level: LeaseNextActionUrgency, cap: LeaseNextActionUrgency): LeaseNextActionUrgency {
  const rank: Record<LeaseNextActionUrgency, number> = { low: 0, medium: 1, high: 2, critical: 3 };
  return rank[level] <= rank[cap] ? level : cap;
}

/** 0 = intend to exercise (projected end if notice served today); 1 = decision reminder. */
type BreakPriorityTier = 0 | 1;

type BreakResultWithTier = LeaseNextActionResult & {
  readonly _tier: BreakPriorityTier;
  readonly _sortDays: number;
};

function intendProjectedEndRow(extracted: ExtractedForNextAction): BreakResultWithTier | null {
  const endIso = projectedTenancyEndIfNoticeServedToday(extracted.notice_period_days);
  if (!endIso) {
    return null;
  }
  const days = calendarDaysRemaining(endIso);
  if (days === null) {
    return null;
  }
  return {
    action_type: "lease_expiry",
    action_date: endIso,
    days_remaining: days,
    urgency_level: urgencyFromDays(days),
    counts_toward_critical: true,
    break_clause_tier: "intend_projected_end",
    _tier: 0,
    _sortDays: days,
  };
}

function decisionReminderRow(
  extracted: ExtractedForNextAction,
  breakIso: string,
): BreakResultWithTier | null {
  const availableFrom = breakWindowOpensIso(breakIso, extracted.notice_period_days);
  if (!availableFrom) {
    return null;
  }
  const daysUntilOpen = calendarDaysRemaining(availableFrom);
  if (daysUntilOpen === null) {
    return null;
  }
  const windowOpen = daysUntilOpen <= 0;
  return {
    action_type: "break_notice_deadline",
    action_date: null,
    days_remaining: null,
    break_available_from: availableFrom,
    urgency_level: windowOpen ? "high" : "medium",
    counts_toward_critical: true,
    break_clause_tier: "decision_reminder",
    _tier: 1,
    _sortDays: daysUntilOpen,
  };
}

function singleBreakRow(
  extracted: ExtractedForNextAction,
  breakIso: string,
  status: ReturnType<typeof statusForBreakDate>,
): BreakResultWithTier | null {
  if (status === "intend_to_exercise") {
    return intendProjectedEndRow(extracted);
  }

  if (status === "under_review" || status === "available") {
    return decisionReminderRow(extracted, breakIso);
  }

  return null;
}

function breakRowsWithTiers(extracted: ExtractedForNextAction): BreakResultWithTier[] {
  const statusMap = parseBreakClauseStatusMap(extracted.break_clause_status ?? null);
  const out: BreakResultWithTier[] = [];
  for (const breakIso of jsonStringArray(extracted.break_dates)) {
    if (!validDateIso(breakIso)) {
      continue;
    }
    const status = statusForBreakDate(breakIso, statusMap);
    if (isBreakClauseSuppressed(status)) {
      continue;
    }
    const row = singleBreakRow(extracted, breakIso, status);
    if (row) {
      out.push(row);
    }
  }
  return out;
}

function stripBreakTier(row: BreakResultWithTier): LeaseNextActionResult {
  const { _tier: _t, _sortDays: _s, ...rest } = row;
  return rest;
}

function tier2RentReviewIsos(extracted: ExtractedForNextAction): string[] {
  return jsonStringArray(extracted.rent_review_dates).filter(validDateIso);
}

export function urgencyFromDays(days: number): LeaseNextActionUrgency {
  if (days <= 0) {
    return "critical";
  }
  if (days <= 7) {
    return "critical";
  }
  if (days <= 30) {
    return "high";
  }
  if (days <= 90) {
    return "medium";
  }
  return "low";
}

function needsManualReview(extracted: ExtractedForNextAction): boolean {
  return extracted.manual_review_recommended === true || extracted.ambiguous_language === true;
}

function sortedBreakTierStrip(tiers: BreakResultWithTier[], tier: BreakPriorityTier): LeaseNextActionResult[] {
  return tiers
    .filter((t) => t._tier === tier)
    .sort((a, b) => a._sortDays - b._sortDays)
    .map(stripBreakTier);
}

function pickSoonestTierRow(tiers: BreakResultWithTier[], tier: BreakPriorityTier): BreakResultWithTier | null {
  const subset = tiers.filter((t) => t._tier === tier);
  if (subset.length === 0) {
    return null;
  }
  return subset.sort((a, b) => a._sortDays - b._sortDays)[0] ?? null;
}

function rentReviewActionResults(extracted: ExtractedForNextAction): LeaseNextActionResult[] {
  const byIso = new Map<string, LeaseNextActionResult>();
  for (const iso of tier2RentReviewIsos(extracted)) {
    const days = calendarDaysRemaining(iso);
    if (days === null) {
      continue;
    }
    byIso.set(iso, {
      action_type: "rent_review",
      action_date: iso,
      days_remaining: days,
      urgency_level: urgencyFromDays(days),
    });
  }
  return [...byIso.values()].sort((a, b) => (a.days_remaining ?? 0) - (b.days_remaining ?? 0));
}

function expiryActionResult(extracted: ExtractedForNextAction): LeaseNextActionResult | null {
  const expiryIso = effectiveExpiryDate(extracted);
  if (!expiryIso || !validDateIso(expiryIso)) {
    return null;
  }
  const days = calendarDaysRemaining(expiryIso);
  if (days === null) {
    return null;
  }
  return {
    action_type: "lease_expiry",
    action_date: expiryIso,
    days_remaining: days,
    urgency_level: urgencyFromDays(days),
  };
}

/**
 * All items in display order: break decision reminders, rent reviews,
 * lease expiry, informational break opportunities, then manual review when flagged.
 */
export function computeAllLeaseActionsInPriorityOrder(
  extracted: ExtractedForNextAction | null,
): LeaseNextActionResult[] {
  if (!extracted) {
    return [];
  }

  const tiers = breakRowsWithTiers(extracted);
  const out: LeaseNextActionResult[] = [];
  out.push(...sortedBreakTierStrip(tiers, 0));
  out.push(...sortedBreakTierStrip(tiers, 1));
  out.push(...rentReviewActionResults(extracted));
  const exp = expiryActionResult(extracted);
  if (exp) {
    out.push(exp);
  }
  if (needsManualReview(extracted)) {
    out.push({
      action_type: "manual_review",
      action_date: null,
      days_remaining: null,
      urgency_level: "high",
    });
  }
  return out;
}

/**
 * Strict priority: (1) projected tenancy end (intend to exercise), (2) break decision reminder,
 * (3) rent reviews, (4) lease expiry, (5) manual review.
 */
export function computeLeaseNextAction(extracted: ExtractedForNextAction | null): LeaseNextActionResult | null {
  if (!extracted) {
    return null;
  }

  const tiers = breakRowsWithTiers(extracted);
  const intend = pickSoonestTierRow(tiers, 0);
  if (intend) {
    return stripBreakTier(intend);
  }
  const decision = pickSoonestTierRow(tiers, 1);
  if (decision) {
    return stripBreakTier(decision);
  }

  const r = bestIsoInTier(tier2RentReviewIsos(extracted));
  if (r) {
    return {
      action_type: "rent_review",
      action_date: r.iso,
      days_remaining: r.days,
      urgency_level: urgencyFromDays(r.days),
    };
  }

  const expiryIso = effectiveExpiryDate(extracted);
  if (expiryIso && validDateIso(expiryIso)) {
    const days = calendarDaysRemaining(expiryIso);
    if (days !== null) {
      return {
        action_type: "lease_expiry",
        action_date: expiryIso,
        days_remaining: days,
        urgency_level: urgencyFromDays(days),
      };
    }
  }

  if (needsManualReview(extracted)) {
    return {
      action_type: "manual_review",
      action_date: null,
      days_remaining: null,
      urgency_level: "high",
    };
  }

  return null;
}

export function isLeaseCriticalActionDue(next: LeaseNextActionResult | null): boolean {
  if (!next) {
    return false;
  }
  if (next.counts_toward_critical === false) {
    return false;
  }
  if (next.action_type === "manual_review") {
    return true;
  }
  if (next.break_clause_tier === "decision_reminder" && next.break_available_from) {
    const daysUntilOpen = calendarDaysRemaining(next.break_available_from);
    return daysUntilOpen !== null && daysUntilOpen <= 90;
  }
  if (next.urgency_level === "high" || next.urgency_level === "critical") {
    return true;
  }
  return next.days_remaining !== null && next.days_remaining <= 90;
}
