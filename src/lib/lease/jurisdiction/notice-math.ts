import { parseIsoDateUtc, utcDateOnlyString } from "@/lib/alerts/date-helpers";
import { breakRulesForJurisdiction } from "@/lib/lease/jurisdiction/break-rules";
import {
  addBusinessDays,
  businessDayLocaleFromCountry,
  subtractBusinessDays,
  type BusinessDayLocale,
} from "@/lib/lease/jurisdiction/business-days";
import {
  addCalendarMonths,
  resolvedNoticePeriodDayCount,
  subtractCalendarMonths,
} from "@/lib/lease/jurisdiction/notice-period";
import { parseNoticePeriodSpec } from "@/lib/lease/jurisdiction/parse-notice-period-spec";
import { isLeaseJurisdiction, type LeaseJurisdiction, type NoticePeriodSpec } from "@/lib/lease/jurisdiction/types";
import type { Json } from "@/lib/supabase/database.types";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export type NoticeMathContext = Readonly<{
  jurisdiction: LeaseJurisdiction;
  businessDayLocale: BusinessDayLocale;
  noticePeriodDays: number | null;
  spec: NoticePeriodSpec | null;
}>;

export function buildNoticeMathContext(parts: Readonly<{
  leaseJurisdiction?: string | null;
  premisesCountry?: string | null;
  noticePeriodDays: number | null;
  noticePeriodSpec?: Json | null;
}>): NoticeMathContext {
  const jurisdiction =
    parts.leaseJurisdiction && isLeaseJurisdiction(parts.leaseJurisdiction)
      ? parts.leaseJurisdiction
      : "other";
  return {
    jurisdiction,
    businessDayLocale: businessDayLocaleFromCountry(parts.premisesCountry, jurisdiction),
    noticePeriodDays: parts.noticePeriodDays,
    spec: parseNoticePeriodSpec(parts.noticePeriodSpec),
  };
}

function validIso(iso: string): boolean {
  return ISO.test(iso) && parseIsoDateUtc(iso) !== null;
}

function subtractCalendarDays(iso: string, days: number): string | null {
  const d = parseIsoDateUtc(iso);
  if (!d || days < 1) {
    return null;
  }
  d.setUTCDate(d.getUTCDate() - days);
  return utcDateOnlyString(d);
}

function addCalendarDays(iso: string, days: number): string | null {
  const d = parseIsoDateUtc(iso);
  if (!d || days < 1) {
    return null;
  }
  d.setUTCDate(d.getUTCDate() + days);
  return utcDateOnlyString(d);
}

function usesBusinessDays(ctx: NoticeMathContext): boolean {
  const spec = ctx.spec;
  if (!spec) {
    return false;
  }
  return spec.unit === "business_days" || spec.day_basis === "business";
}

function capAtBreakDate(endIso: string, breakDateIso: string | undefined, ctx: NoticeMathContext): string {
  if (!breakDateIso || !validIso(breakDateIso) || !validIso(endIso)) {
    return endIso;
  }
  if (!breakRulesForJurisdiction(ctx.jurisdiction).tenancyEndCapsAtBreakDate) {
    return endIso;
  }
  return endIso <= breakDateIso ? endIso : breakDateIso;
}

/**
 * First calendar date the break option may be exercised (break date minus notice period).
 */
export function breakWindowOpensIso(breakIso: string, ctx: NoticeMathContext): string | null {
  if (!validIso(breakIso)) {
    return null;
  }

  const rules = breakRulesForJurisdiction(ctx.jurisdiction);
  const spec = ctx.spec;

  if (
    spec &&
    spec.unit === "months" &&
    rules.monthNoticeUsesCalendarMonths &&
    (spec.anchor === "before_break_date" || spec.anchor === "unspecified" || spec.anchor == null)
  ) {
    return subtractCalendarMonths(breakIso, spec.value) ?? breakIso;
  }

  if (usesBusinessDays(ctx) && spec) {
    const opened = subtractBusinessDays(breakIso, spec.value, ctx.businessDayLocale);
    if (opened) {
      return opened;
    }
  }

  const days = resolvedNoticePeriodDayCount(ctx.noticePeriodDays, spec);
  if (days != null && days >= 1) {
    return subtractCalendarDays(breakIso, days) ?? breakIso;
  }

  return breakIso;
}

/**
 * Tenancy end from a served break notice (notice served date + notice period).
 */
export function tenancyEndFromServedNotice(
  noticeServedDate: string,
  ctx: NoticeMathContext,
  options?: Readonly<{ breakDateIso?: string }>,
): string | null {
  if (!validIso(noticeServedDate)) {
    return null;
  }

  const rules = breakRulesForJurisdiction(ctx.jurisdiction);
  const spec = ctx.spec;
  let end: string | null = null;

  if (spec && spec.unit === "months" && rules.monthNoticeUsesCalendarMonths) {
    end = addCalendarMonths(noticeServedDate, spec.value);
  } else if (usesBusinessDays(ctx) && spec) {
    end = addBusinessDays(noticeServedDate, spec.value, ctx.businessDayLocale);
  } else {
    const days = resolvedNoticePeriodDayCount(ctx.noticePeriodDays, spec);
    if (days != null && days >= 1) {
      end = addCalendarDays(noticeServedDate, days);
    } else {
      end = noticeServedDate;
    }
  }

  if (!end) {
    return null;
  }
  return capAtBreakDate(end, options?.breakDateIso, ctx);
}

/** Rolling projected end if notice were served on `asOfIso` (defaults to today). */
export function projectedTenancyEndIfNoticeServedOn(
  ctx: NoticeMathContext,
  asOfIso: string,
  options?: Readonly<{ breakDateIso?: string }>,
): string | null {
  return tenancyEndFromServedNotice(asOfIso, ctx, options);
}
