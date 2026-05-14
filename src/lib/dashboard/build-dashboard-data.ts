import {
  computeAllLeaseActionsInPriorityOrder,
  isLeaseCriticalActionDue,
  LEASE_NEXT_ACTION_LABEL,
  type LeaseNextActionResult,
} from "@/lib/lease/compute-lease-next-action";
import { effectiveLeaseNextAction, extractedRowToNextActionInput } from "@/lib/lease/effective-lease-next-action";
import { formatNextActionDueLabel } from "@/lib/lease/format-next-action-due-label";
import type {
  DashboardData,
  DashboardDeadlineAlert,
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

function formatAlertDueDate(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  const d = new Date(`${iso}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    return iso;
  }
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

type DeadlineAlertSortRow = DashboardDeadlineAlert & {
  sortDays: number | null;
  sortDate: string | null;
};

function compareDeadlineAlerts(a: DeadlineAlertSortRow, b: DeadlineAlertSortRow): number {
  const aDated = a.sortDays !== null;
  const bDated = b.sortDays !== null;
  if (aDated && bDated) {
    const adn = a.sortDays!;
    const bdn = b.sortDays!;
    if (adn !== bdn) {
      return adn - bdn;
    }
    const ad = a.sortDate ?? "";
    const bd = b.sortDate ?? "";
    if (ad !== bd) {
      return ad.localeCompare(bd);
    }
    return a.propertyName.localeCompare(b.propertyName);
  }
  if (aDated && !bDated) {
    return -1;
  }
  if (!aDated && bDated) {
    return 1;
  }
  return a.propertyName.localeCompare(b.propertyName);
}

function buildDeadlineAlerts(leaseRows: LeaseWithExtracted[]): DashboardDeadlineAlert[] {
  const rows: DeadlineAlertSortRow[] = [];

  for (const row of leaseRows) {
    const extracted = normalizedExtracted(row);
    const next = effectiveLeaseNextAction(row, extracted);
    if (!next) {
      continue;
    }
    const actions = allActionResultsForRow(row, next);

    for (const r of actions) {
      if (r.action_type === "manual_review") {
        rows.push({
          leaseId: row.id,
          propertyName: row.property_name,
          eventType: LEASE_NEXT_ACTION_LABEL[r.action_type],
          dueDate: "—",
          urgencyLevel: r.urgency_level,
          sortDays: null,
          sortDate: null,
        });
        continue;
      }
      const days = r.days_remaining;
      if (days === null || days < 0) {
        continue;
      }
      rows.push({
        leaseId: row.id,
        propertyName: row.property_name,
        eventType: LEASE_NEXT_ACTION_LABEL[r.action_type],
        dueDate: formatAlertDueDate(r.action_date),
        urgencyLevel: r.urgency_level,
        sortDays: days,
        sortDate: r.action_date,
      });
    }
  }

  rows.sort(compareDeadlineAlerts);

  return rows.map(({ sortDays: _sd, sortDate: _st, ...alert }) => alert);
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
    const extracted = normalizedExtracted(row);
    const next = effectiveLeaseNextAction(row, extracted);
    const allActionsInPriorityOrder: DashboardUpcomingActionItem[] = next
      ? allActionResultsForRow(row, next).map(resultToUpcomingItem)
      : [];

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
      allActionsInPriorityOrder: allActionsInPriorityOrder,
    };
  });

  const deadlineAlerts = buildDeadlineAlerts(leaseRows);

  return { metrics, leases, deadlineAlerts };
}
