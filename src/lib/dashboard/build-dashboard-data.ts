import {
  computeAllLeaseActionsInPriorityOrder,
  computeLeaseNextAction,
  isLeaseCriticalActionDue,
  LEASE_NEXT_ACTION_LABEL,
  type LeaseNextActionResult,
} from "@/lib/lease/compute-lease-next-action";
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

function extractedSlim(row: LeaseWithExtracted) {
  const extracted = normalizedExtracted(row);
  if (!extracted) {
    return null;
  }
  return {
    expiry_date: extracted.expiry_date,
    break_dates: extracted.break_dates,
    notice_period_days: extracted.notice_period_days,
    rent_review_dates: extracted.rent_review_dates,
    ambiguous_language: extracted.ambiguous_language,
    manual_review_recommended: extracted.manual_review_recommended,
  };
}

function effectiveNextAction(row: LeaseWithExtracted): LeaseNextActionResult | null {
  if (
    row.extraction_status === "complete" &&
    row.next_action_type != null &&
    row.next_action_urgency != null
  ) {
    return {
      action_type: row.next_action_type,
      action_date: row.next_action_date,
      days_remaining: row.next_action_days_remaining,
      urgency_level: row.next_action_urgency,
    };
  }

  const extracted = normalizedExtracted(row);
  if (!extracted) {
    return null;
  }

  return computeLeaseNextAction({
    expiry_date: extracted.expiry_date,
    break_dates: extracted.break_dates,
    notice_period_days: extracted.notice_period_days,
    rent_review_dates: extracted.rent_review_dates,
    ambiguous_language: extracted.ambiguous_language,
    manual_review_recommended: extracted.manual_review_recommended,
  });
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

function formatActionDueLabel(next: LeaseNextActionResult): string {
  if (next.action_type === "manual_review") {
    return "Review recommended";
  }
  if (next.days_remaining === null || !next.action_date) {
    return "—";
  }
  if (next.days_remaining <= 0) {
    return "Due now";
  }
  if (next.days_remaining === 1) {
    return "In 1 day";
  }
  if (next.days_remaining < 14) {
    return `In ${next.days_remaining} days`;
  }
  const d = new Date(`${next.action_date}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    return next.action_date;
  }
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function allActionResultsForRow(row: LeaseWithExtracted, nextFallback: LeaseNextActionResult): LeaseNextActionResult[] {
  const slim = extractedSlim(row);
  const fromExtracted = slim ? computeAllLeaseActionsInPriorityOrder(slim) : [];
  if (fromExtracted.length > 0) {
    return fromExtracted;
  }
  return [nextFallback];
}

function resultToUpcomingItem(r: LeaseNextActionResult): DashboardUpcomingActionItem {
  return {
    label: LEASE_NEXT_ACTION_LABEL[r.action_type],
    dueLabel: formatActionDueLabel(r),
    severity: severityFromUrgency(r.urgency_level),
    actionDate: r.action_date,
    daysRemaining: r.days_remaining,
  };
}

export function buildDashboardData(leaseRows: LeaseWithExtracted[]): DashboardData {
  const metrics: DashboardMetrics = {
    totalLeases: leaseRows.length,
    criticalActionsDue: leaseRows.filter((row) => isLeaseCriticalActionDue(effectiveNextAction(row))).length,
    highRiskLeases: leaseRows.filter((row) => row.overall_risk === "high").length,
  };

  const leases: DashboardLeaseRow[] = leaseRows.map((row) => {
    const next = effectiveNextAction(row);
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
      const next = effectiveNextAction(row);
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
      dueLabel: formatActionDueLabel(primary),
      severity: severityFromUrgency(primary.urgency_level),
      allActionsInPriorityOrder: allResults.map(resultToUpcomingItem),
    }));

  return { metrics, leases, alerts: actionAlerts };
}
