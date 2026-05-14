import type { LeaseAnalyseOutput } from "@/lib/lease/lease-analyse-schema";
import type { Json } from "@/lib/supabase/database.types";

export const LEASE_AFFECTED_AREAS = [
  "lease_term",
  "break_clauses",
  "rent_review",
  "repairing_obligations",
  "service_charge",
  "other",
] as const;

export type LeaseAffectedArea = (typeof LEASE_AFFECTED_AREAS)[number];

export const LEASE_AFFECTED_AREA_LABEL: Record<LeaseAffectedArea, string> = {
  lease_term: "Lease term",
  break_clauses: "Break clauses",
  rent_review: "Rent review",
  repairing_obligations: "Repairing obligations",
  service_charge: "Service charge",
  other: "Other",
};

export function supersedesKeysForAffectedArea(area: LeaseAffectedArea): (keyof LeaseAnalyseOutput)[] {
  switch (area) {
    case "lease_term":
      return ["commencement_date", "expiry_date"];
    case "break_clauses":
      return ["break_dates", "notice_period_days"];
    case "rent_review":
      return ["rent_review_dates"];
    case "repairing_obligations":
      return ["repairing_obligation", "reinstatement_required", "vacant_possession_required"];
    case "service_charge":
      return ["service_charge_responsibility"];
    case "other":
    default:
      return ["conditional_break_clause", "ambiguous_language", "manual_review_recommended"];
  }
}

export function isLeaseAffectedArea(value: string): value is LeaseAffectedArea {
  return (LEASE_AFFECTED_AREAS as readonly string[]).includes(value);
}

/** JSON array for `supersedes_fields` from affected-area selection. */
export function supersedesFieldsJsonFromArea(area: LeaseAffectedArea): Json {
  return supersedesKeysForAffectedArea(area).map(String) as unknown as Json;
}
