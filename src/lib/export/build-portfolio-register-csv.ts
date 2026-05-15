import { buildDashboardData } from "@/lib/dashboard/build-dashboard-data";
import { DEFAULT_DISPLAY_LOCALE } from "@/lib/lease/format-app-date";
import { csvRow, withUtf8Bom } from "@/lib/export/csv-escape";
import type { LeaseWithExtractedForExport } from "@/lib/export/fetch-leases-for-export";
import { PROPERTY_TYPES } from "@/lib/lease/property-types";
import { LEASE_NEXT_ACTION_LABEL } from "@/lib/lease/compute-lease-next-action";
import type { LeaseNextActionType, LeaseReviewStatus } from "@/lib/supabase/database.types";

function propertyTypeLabel(value: string): string {
  return PROPERTY_TYPES.find((p) => p.value === value)?.label ?? value;
}

function verificationLabel(status: LeaseReviewStatus): string {
  const map: Record<LeaseReviewStatus, string> = {
    not_required: "Not required",
    needs_review: "Needs review",
    verified: "Verified",
    unresolved: "Unresolved",
  };
  return map[status];
}

function nextActionTypeLabel(t: LeaseNextActionType | null): string {
  if (!t) {
    return "";
  }
  return LEASE_NEXT_ACTION_LABEL[t];
}

export function buildPortfolioRegisterCsv(leaseRows: LeaseWithExtractedForExport[]): string {
  const data = buildDashboardData(leaseRows, DEFAULT_DISPLAY_LOCALE);
  const header = csvRow([
    "lease_id",
    "property_name",
    "property_type",
    "term_status",
    "expiry_date",
    "next_critical_action",
    "action_date",
    "days_remaining",
    "action_urgency",
    "overall_risk",
    "extraction_status",
    "verification_status",
    "denormalised_next_action_type",
    "denormalised_next_action_date",
    "denormalised_next_action_days_remaining",
    "denormalised_next_action_urgency",
    "upload_date",
  ]);

  let body = "";
  data.leases.forEach((row, i) => {
    const raw = leaseRows[i];
    if (!raw) {
      return;
    }
    body += csvRow([
      row.id,
      row.propertyName,
      propertyTypeLabel(raw.property_type),
      row.termStatus,
      row.expiryDate ?? "",
      row.nextCriticalAction,
      row.actionDate ?? "",
      row.daysRemaining === null ? "" : String(row.daysRemaining),
      row.urgencyLevel ?? "",
      row.riskLevel,
      row.extractionStatus,
      verificationLabel(raw.review_status),
      nextActionTypeLabel(raw.next_action_type),
      raw.next_action_date ?? "",
      raw.next_action_days_remaining === null ? "" : String(raw.next_action_days_remaining),
      raw.next_action_urgency ?? "",
      raw.upload_date,
    ]);
  });

  return withUtf8Bom(header + body);
}
