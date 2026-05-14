import { parseIsoDateUtc, utcDateOnlyString } from "@/lib/alerts/date-helpers";
import {
  isBreakClauseSuppressed,
  parseBreakClauseStatusMap,
  statusForBreakDate,
} from "@/lib/lease/break-clause-status";
import { jsonStringArray } from "@/lib/lease/lease-detail";
import type { Json, LeaseNextActionType, LeaseNextActionUrgency } from "@/lib/supabase/database.types";

export type { LeaseNextActionType, LeaseNextActionUrgency } from "@/lib/supabase/database.types";

/** How a break row contributes to portfolio “critical” metrics and copy. */
export type BreakClauseNextTier = "opportunity" | "decision_reminder" | "committed_exercise";

export type LeaseNextActionResult = Readonly<{
  action_type: LeaseNextActionType;
  action_date: string | null;
  days_remaining: number | null;
  urgency_level: LeaseNextActionUrgency;
  /**
   * When false, the lease is not counted in “critical actions due” for this item (informational breaks).
   * Omitted means true.
   */
  counts_toward_critical?: boolean;
  /** Present when `action_type` is `break_notice_deadline` and the row comes from a dated break. */
  break_clause_tier?: BreakClauseNextTier;
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
  if (next.break_clause_tier === "opportunity") {
    return "Break opportunity (informational)";
  }
  if (next.break_clause_tier === "decision_reminder") {
    return "Break decision reminder";
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
 * Calendar date (UTC date-only) by which notice must be served for this break,
 * matching tier-1 next-action logic: break date minus notice period, or the break date if no period.
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

function capUrgency(level: LeaseNextActionUrgency, cap: LeaseNextActionUrgency): LeaseNextActionUrgency {
  const rank: Record<LeaseNextActionUrgency, number> = { low: 0, medium: 1, high: 2, critical: 3 };
  return rank[level] <= rank[cap] ? level : cap;
}

type BreakPriorityTier = 0 | 1 | 2;

type BreakResultWithTier = LeaseNextActionResult & { readonly _tier: BreakPriorityTier };

function singleBreakRow(
  extracted: ExtractedForNextAction,
  breakIso: string,
  status: ReturnType<typeof statusForBreakDate>,
): BreakResultWithTier | null {
  const n = noticeDays(extracted.notice_period_days);

  if (status === "intend_to_exercise") {
    const effectiveIso = n !== null ? subtractCalendarDays(breakIso, n) ?? breakIso : breakIso;
    const days = calendarDaysRemaining(effectiveIso);
    if (days === null) {
      return null;
    }
    return {
      action_type: "break_notice_deadline",
      action_date: effectiveIso,
      days_remaining: days,
      urgency_level: urgencyFromDays(days),
      counts_toward_critical: true,
      break_clause_tier: "committed_exercise",
      _tier: 0,
    };
  }

  if (status === "under_review") {
    const effectiveIso = breakNoticeDeadlineIso(breakIso, extracted.notice_period_days) ?? breakIso;
    const days = calendarDaysRemaining(effectiveIso);
    if (days === null) {
      return null;
    }
    return {
      action_type: "break_notice_deadline",
      action_date: effectiveIso,
      days_remaining: days,
      urgency_level: capUrgency(urgencyFromDays(days), "high"),
      counts_toward_critical: true,
      break_clause_tier: "decision_reminder",
      _tier: 1,
    };
  }

  if (status === "available") {
    const days = calendarDaysRemaining(breakIso);
    if (days === null) {
      return null;
    }
    return {
      action_type: "break_notice_deadline",
      action_date: breakIso,
      days_remaining: days,
      urgency_level: "low",
      counts_toward_critical: false,
      break_clause_tier: "opportunity",
      _tier: 2,
    };
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
  const { _tier: _unused, ...rest } = row;
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
    .sort((a, b) => (a.days_remaining ?? 0) - (b.days_remaining ?? 0))
    .map(stripBreakTier);
}

function pickSoonestTierRow(tiers: BreakResultWithTier[], tier: BreakPriorityTier): BreakResultWithTier | null {
  const subset = tiers.filter((t) => t._tier === tier);
  if (subset.length === 0) {
    return null;
  }
  return subset.sort((a, b) => (a.days_remaining ?? 99_999) - (b.days_remaining ?? 99_999))[0] ?? null;
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
  if (!extracted.expiry_date || !validDateIso(extracted.expiry_date)) {
    return null;
  }
  const days = calendarDaysRemaining(extracted.expiry_date);
  if (days === null) {
    return null;
  }
  return {
    action_type: "lease_expiry",
    action_date: extracted.expiry_date,
    days_remaining: days,
    urgency_level: urgencyFromDays(days),
  };
}

/**
 * All items in display order: committed break notice deadlines, decision reminders, rent reviews,
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
  out.push(...sortedBreakTierStrip(tiers, 2));
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
 * Strict priority: (1) committed break notice (intend to exercise), (2) break under review,
 * (3) rent reviews, (4) lease expiry, (5) informational break opportunities, (6) manual review.
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
  const review = pickSoonestTierRow(tiers, 1);
  if (review) {
    return stripBreakTier(review);
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

  if (extracted.expiry_date && validDateIso(extracted.expiry_date)) {
    const days = calendarDaysRemaining(extracted.expiry_date);
    if (days !== null) {
      return {
        action_type: "lease_expiry",
        action_date: extracted.expiry_date,
        days_remaining: days,
        urgency_level: urgencyFromDays(days),
      };
    }
  }

  const opportunity = pickSoonestTierRow(tiers, 2);
  if (opportunity) {
    return stripBreakTier(opportunity);
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
  if (next.urgency_level === "high" || next.urgency_level === "critical") {
    return true;
  }
  return next.days_remaining !== null && next.days_remaining <= 90;
}
