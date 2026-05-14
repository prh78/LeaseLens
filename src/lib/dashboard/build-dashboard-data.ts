import {
  computeAllLeaseActionsInPriorityOrder,
  isLeaseCriticalActionDue,
  LEASE_NEXT_ACTION_LABEL,
  type LeaseNextActionResult,
} from "@/lib/lease/compute-lease-next-action";
import { effectiveLeaseNextAction, extractedRowToNextActionInput } from "@/lib/lease/effective-lease-next-action";
import { formatNextActionDueLabel } from "@/lib/lease/format-next-action-due-label";
import type {
  DashboardAlertRow,
  DashboardData,
  DashboardLeaseRow,
  DashboardMetrics,
  DashboardUpcomingActionItem,
} from "@/lib/dashboard/types";
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

function urgencyRank(level: NonNullable<LeaseNextActionResult["urgency_level"]>): number {
  switch (level) {
    case "critical":
      return 0;
    case "high":
      return 1;
    case "medium":
      return 2;
    default:
      return 3;
  }
}

function severityFromUrgency(level: LeaseNextActionResult["urgency_level"]): DashboardAlertRow["severity"] {
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
    criticalActionsDue: leaseRows.filter((row) =>
      isLeaseCriticalActionDue(effectiveLeaseNextAction(row, normalizedExtracted(row))),
    ).length,
    highRiskLeases: leaseRows.filter((row) => row.overall_risk === "high").length,
  };

  const leases: DashboardLeaseRow[] = leaseRows.map((row) => {
    const next = effectiveLeaseNextAction(row, normalizedExtracted(row));
    return {
      id: row.id,
      propertyName: row.property_name,
      nextCriticalAction: next ? LEASE_NEXT_ACTION_LABEL[next.action_type] : "—",
      actionType: next?.action_type ?? null,
      actionDate: next?.action_date ?? null,
      daysRemaining: next?.days_remaining ?? null,
      urgencyLevel: next?.urgency_level ?? null,
      riskLevel: row.overall_risk,
      extractionStatus: row.extraction_status,
    };
  });

  const actionAlerts: DashboardAlertRow[] = leaseRows
    .map((row) => {
      const extracted = normalizedExtracted(row);
      const next = effectiveLeaseNextAction(row, extracted);
      if (!next) {
        return null;
      }
      const allResults = allActionResultsForRow(row, next);
      const primary = allResults[0]!;
      return { row, primary, allResults };
    })
    .filter((x): x is { row: LeaseWithExtracted; primary: LeaseNextActionResult; allResults: LeaseNextActionResult[] } =>
      x !== null,
    )
    .sort((a, b) => {
      const ur = urgencyRank(a.primary.urgency_level) - urgencyRank(b.primary.urgency_level);
      if (ur !== 0) {
        return ur;
      }
      const da = a.primary.days_remaining ?? 9999;
      const db = b.primary.days_remaining ?? 9999;
      return da - db;
    })
    .slice(0, 20)
    .map(({ row, primary, allResults }) => ({
      id: `lease-next-${row.id}`,
      leaseId: row.id,
      propertyName: row.property_name,
      title: `${row.property_name} — ${LEASE_NEXT_ACTION_LABEL[primary.action_type]}`,
      dueLabel: formatNextActionDueLabel(primary),
      severity: severityFromUrgency(primary.urgency_level),
      allActionsInPriorityOrder: allResults.map(resultToUpcomingItem),
    }));

  return { metrics, leases, alerts: actionAlerts };
}
