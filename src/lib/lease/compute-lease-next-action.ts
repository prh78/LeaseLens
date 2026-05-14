import { parseIsoDateUtc, utcDateOnlyString } from "@/lib/alerts/date-helpers";
import { jsonStringArray } from "@/lib/lease/lease-detail";
import type { Json, LeaseNextActionType, LeaseNextActionUrgency } from "@/lib/supabase/database.types";

export type { LeaseNextActionType, LeaseNextActionUrgency } from "@/lib/supabase/database.types";

export type LeaseNextActionResult = Readonly<{
  action_type: LeaseNextActionType;
  action_date: string | null;
  days_remaining: number | null;
  urgency_level: LeaseNextActionUrgency;
}>;

export const LEASE_NEXT_ACTION_LABEL: Record<LeaseNextActionType, string> = {
  break_notice_deadline: "Break notice deadline",
  rent_review: "Rent review",
  lease_expiry: "Lease expiry",
  manual_review: "Manual review required",
};

export type ExtractedForNextAction = Readonly<{
  expiry_date: string | null;
  break_dates: Json;
  notice_period_days: number | null;
  rent_review_dates: Json;
  ambiguous_language: boolean | null;
  manual_review_recommended: boolean | null;
}>;

function calendarDaysRemaining(eventIso: string): number | null {
  const event = parseIsoDateUtc(eventIso);
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

function tier1NoticeIsos(extracted: ExtractedForNextAction): string[] {
  const n = noticeDays(extracted.notice_period_days);
  const out: string[] = [];
  for (const breakIso of jsonStringArray(extracted.break_dates)) {
    if (!validDateIso(breakIso)) {
      continue;
    }
    if (n !== null) {
      const deadline = subtractCalendarDays(breakIso, n) ?? breakIso;
      out.push(deadline);
    } else {
      out.push(breakIso);
    }
  }
  return out;
}

function tier2RentReviewIsos(extracted: ExtractedForNextAction): string[] {
  return jsonStringArray(extracted.rent_review_dates).filter(validDateIso);
}

function urgencyFromDays(days: number): LeaseNextActionUrgency {
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

/**
 * Strict priority: (1) break notice deadlines / break dates, (2) rent reviews,
 * (3) lease expiry, (4) manual review when no dated milestones exist.
 */
export function computeLeaseNextAction(extracted: ExtractedForNextAction | null): LeaseNextActionResult | null {
  if (!extracted) {
    return null;
  }

  const b = bestIsoInTier(tier1NoticeIsos(extracted));
  if (b) {
    return {
      action_type: "break_notice_deadline",
      action_date: b.iso,
      days_remaining: b.days,
      urgency_level: urgencyFromDays(b.days),
    };
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
  if (next.action_type === "manual_review") {
    return true;
  }
  if (next.urgency_level === "high" || next.urgency_level === "critical") {
    return true;
  }
  return next.days_remaining !== null && next.days_remaining <= 90;
}
