import {
  computeAllLeaseActionsInPriorityOrder,
  isLeaseCriticalActionDue,
  LEASE_NEXT_ACTION_LABEL,
  type LeaseNextActionResult,
} from "@/lib/lease/compute-lease-next-action";
import { effectiveLeaseNextAction, extractedRowToNextActionInput } from "@/lib/lease/effective-lease-next-action";
import { formatNextActionDueLabel } from "@/lib/lease/format-next-action-due-label";
import { leaseTermStatusFromExpiryDate } from "@/lib/lease/lease-term-status";
import type { DashboardData, DashboardLeaseRow, DashboardMetrics, DashboardUpcomingActionItem } from "@/lib/dashboard/types";
import type { Tables } from "@/lib/supabase/database.types";

type LeaseWithExtracted = Tables<"leases"> & {
  extracted_data: Tables<"extracted_data"> | Tables<"extracted_data">[] | null;
};

function normalizedExtracted(row: LeaseWithExtracted): Tables<"extracted_data"> | null {
  const ed = row.extracted_data;
  if (!ed) {
    return null;
  }
  return Array.isArray(ed) ? ed[0] ?? null : ed;
}

function severityFromUrgency(level: LeaseNextActionResult["urgency_level"]): DashboardUpcomingActionItem["severity"] {
  if (level === "critical") {
    return "critical";
  }
  if (level === "high") {
    return "warning";
  }
  return "info";
}

function allActionResultsForRow(row: LeaseWithExtracted, nextFallback: LeaseNextActionResult): LeaseNextActionResult[] {
  const extracted = normalizedExtracted(row);
  const slim = extracted ? extractedRowToNextActionInput(extracted) : null;
  const fromExtracted = slim ? computeAllLeaseActionsInPriorityOrder(slim) : [];
  if (fromExtracted.length > 0) {
    return fromExtracted;
  }
  return [nextFallback];
}

function resultToUpcomingItem(r: LeaseNextActionResult): DashboardUpcomingActionItem {
  return {
    label: LEASE_NEXT_ACTION_LABEL[r.action_type],
    dueLabel: formatNextActionDueLabel(r),
    severity: severityFromUrgency(r.urgency_level),
    actionDate: r.action_date,
    daysRemaining: r.days_remaining,
  };
}

export function buildDashboardData(leaseRows: LeaseWithExtracted[]): DashboardData {
  const metrics: DashboardMetrics = {
    totalLeases: leaseRows.length,
    criticalActionsDue: leaseRows.filter((row) => {
      const extracted = normalizedExtracted(row);
      if (leaseTermStatusFromExpiryDate(extracted?.expiry_date ?? null) === "expired") {
        return false;
      }
      return isLeaseCriticalActionDue(effectiveLeaseNextAction(row, extracted));
    }).length,
    highRiskLeases: leaseRows.filter((row) => row.overall_risk === "high").length,
  };

  const leases: DashboardLeaseRow[] = leaseRows.map((row) => {
    const extracted = normalizedExtracted(row);
    const termStatus = leaseTermStatusFromExpiryDate(extracted?.expiry_date ?? null);

    if (termStatus === "expired") {
      return {
        id: row.id,
        propertyName: row.property_name,
        termStatus,
        nextCriticalAction: "—",
        actionType: null,
        actionDate: null,
        daysRemaining: null,
        urgencyLevel: null,
        riskLevel: row.overall_risk,
        extractionStatus: row.extraction_status,
        allActionsInPriorityOrder: [],
      };
    }

    const next = effectiveLeaseNextAction(row, extracted);
    const allActionsInPriorityOrder: DashboardUpcomingActionItem[] = next
      ? allActionResultsForRow(row, next).map(resultToUpcomingItem)
      : [];

    return {
      id: row.id,
      propertyName: row.property_name,
      termStatus,
      nextCriticalAction: next ? LEASE_NEXT_ACTION_LABEL[next.action_type] : "—",
      actionType: next?.action_type ?? null,
      actionDate: next?.action_date ?? null,
      daysRemaining: next?.days_remaining ?? null,
      urgencyLevel: next?.urgency_level ?? null,
      riskLevel: row.overall_risk,
      extractionStatus: row.extraction_status,
      allActionsInPriorityOrder: allActionsInPriorityOrder,
    };
  });

  return { metrics, leases };
}
