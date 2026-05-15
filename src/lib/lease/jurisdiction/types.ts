/** Region pack for extraction prompts and UI copy. */
export const LEASE_JURISDICTIONS = ["uk", "us", "eu", "apac", "other"] as const;

export type LeaseJurisdiction = (typeof LEASE_JURISDICTIONS)[number];

export const LEASE_JURISDICTION_LABEL: Record<LeaseJurisdiction, string> = {
  uk: "United Kingdom",
  us: "United States",
  eu: "Europe (EU / EEA)",
  apac: "Asia-Pacific",
  other: "Other / mixed",
};

export function isLeaseJurisdiction(value: string): value is LeaseJurisdiction {
  return (LEASE_JURISDICTIONS as readonly string[]).includes(value);
}

/** Notice period as stated in the lease (before normalisation to days). */
export const NOTICE_PERIOD_UNITS = ["calendar_days", "business_days", "months", "years"] as const;

export type NoticePeriodUnit = (typeof NOTICE_PERIOD_UNITS)[number];

export const NOTICE_DAY_BASIS = ["calendar", "business"] as const;

export type NoticeDayBasis = (typeof NOTICE_DAY_BASIS)[number];

export const NOTICE_ANCHORS = [
  "before_break_date",
  "before_expiry",
  "unspecified",
] as const;

export type NoticeAnchor = (typeof NOTICE_ANCHORS)[number];

export type NoticePeriodSpec = Readonly<{
  value: number;
  unit: NoticePeriodUnit;
  day_basis?: NoticeDayBasis | null;
  anchor?: NoticeAnchor | null;
  /** Verbatim or near-verbatim lease wording for audit. */
  source_text?: string | null;
}>;
