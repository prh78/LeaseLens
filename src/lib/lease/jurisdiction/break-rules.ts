import { isLeaseJurisdiction, type LeaseJurisdiction } from "@/lib/lease/jurisdiction/types";

/** How the product refers to the tenant exit right in UI and exports. */
export type BreakOptionKind = "break" | "early_termination";

/**
 * Jurisdiction-specific flags for break / early-termination date math.
 * v1 sketch — confirm against signed leases before legal reliance.
 */
export type JurisdictionBreakRules = Readonly<{
  breakOptionKind: BreakOptionKind;
  /** Subtract/add whole calendar months when notice is stated in months (typical UK/EU break). */
  monthNoticeUsesCalendarMonths: boolean;
  /** Walk a Mon–Fri (+ locale holidays) calendar for business-day notice. */
  applyBusinessDayCalendar: boolean;
  /**
   * When exercising on a fixed break date, tenancy end does not extend past that date
   * (common US early-termination framing).
   */
  tenancyEndCapsAtBreakDate: boolean;
}>;

const RULES: Record<LeaseJurisdiction, JurisdictionBreakRules> = {
  uk: {
    breakOptionKind: "break",
    monthNoticeUsesCalendarMonths: true,
    applyBusinessDayCalendar: true,
    tenancyEndCapsAtBreakDate: false,
  },
  eu: {
    breakOptionKind: "break",
    monthNoticeUsesCalendarMonths: true,
    applyBusinessDayCalendar: true,
    tenancyEndCapsAtBreakDate: false,
  },
  us: {
    breakOptionKind: "early_termination",
    monthNoticeUsesCalendarMonths: false,
    applyBusinessDayCalendar: true,
    tenancyEndCapsAtBreakDate: true,
  },
  apac: {
    breakOptionKind: "break",
    monthNoticeUsesCalendarMonths: true,
    applyBusinessDayCalendar: true,
    tenancyEndCapsAtBreakDate: false,
  },
  other: {
    breakOptionKind: "break",
    monthNoticeUsesCalendarMonths: false,
    applyBusinessDayCalendar: true,
    tenancyEndCapsAtBreakDate: false,
  },
};

export function breakRulesForJurisdiction(jurisdiction: string | null | undefined): JurisdictionBreakRules {
  if (jurisdiction && isLeaseJurisdiction(jurisdiction)) {
    return RULES[jurisdiction];
  }
  return RULES.other;
}

/** Short UI hint for the break panel when rules differ from default UK-style break. */
export function breakRulesHint(jurisdiction: string | null | undefined): string | null {
  const rules = breakRulesForJurisdiction(jurisdiction);
  if (rules.breakOptionKind === "early_termination") {
    return "US-style early termination: projected end may be capped at the break date; confirm against your lease.";
  }
  if (rules.monthNoticeUsesCalendarMonths) {
    return null;
  }
  return "Month-based notice uses approximate day counts for this region pack; confirm critical dates manually.";
}
