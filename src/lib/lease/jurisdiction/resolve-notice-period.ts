import type { NoticePeriodSpec } from "@/lib/lease/jurisdiction/types";
import { noticePeriodToCalendarDays } from "@/lib/lease/jurisdiction/notice-period";

export type ResolvedNoticePeriod = Readonly<{
  notice_period_days: number | null;
  requires_manual_review: boolean;
}>;

/**
 * Normalises model output into stored `notice_period_days` per Phase 1 rules:
 * use calendar-day count when confident; otherwise null and flag review.
 */
export function resolveNoticePeriodForStorage(
  daysFromModel: number | null,
  spec: NoticePeriodSpec | null,
): ResolvedNoticePeriod {
  if (spec?.unit === "calendar_days" && spec.value >= 1) {
    return {
      notice_period_days: Math.floor(spec.value),
      requires_manual_review: false,
    };
  }

  const conversion = noticePeriodToCalendarDays(spec);

  if (daysFromModel != null && daysFromModel >= 1) {
    if (!spec) {
      return {
        notice_period_days: Math.floor(daysFromModel),
        requires_manual_review: false,
      };
    }
    if (conversion.confident && conversion.days != null) {
      return {
        notice_period_days: conversion.days,
        requires_manual_review: false,
      };
    }
    return {
      notice_period_days: Math.floor(daysFromModel),
      requires_manual_review: !conversion.confident,
    };
  }

  if (conversion.confident && conversion.days != null) {
    return {
      notice_period_days: conversion.days,
      requires_manual_review: false,
    };
  }

  if (spec) {
    return {
      notice_period_days: null,
      requires_manual_review: true,
    };
  }

  return {
    notice_period_days: null,
    requires_manual_review: false,
  };
}
