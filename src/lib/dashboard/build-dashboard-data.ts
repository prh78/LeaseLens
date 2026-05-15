import {
  computeAllLeaseActionsInPriorityOrder,
  isLeaseCriticalActionDue,
  nextActionDisplayLabel,
  type LeaseNextActionResult,
} from "@/lib/lease/compute-lease-next-action";
import { effectiveLeaseNextAction, extractedRowToNextActionInput } from "@/lib/lease/effective-lease-next-action";
import { effectiveExpiryDate } from "@/lib/lease/break-clause-status";
import { formatNextActionDueLabel } from "@/lib/lease/format-next-action-due-label";
import { leaseTermStatusFromExpiryDate } from "@/lib/lease/lease-term-status";
import type {
  DashboardData,
  DashboardLeaseRow,
  DashboardMetrics,
  DashboardReviewQueueItem,
  DashboardUpcomingActionItem,
} from "@/lib/dashboard/types";
import type { Json, LeaseReviewPriority, Tables } from "@/lib/supabase/database.types";

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

function reviewAffectedFieldsFromDb(raw: Json): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((x): x is string => typeof x === "string");
}

function reviewPriorityRank(p: LeaseReviewPriority): number {
  if (p === "high") {
    return 0;
  }
  if (p === "medium") {
    return 1;
  }
  return 2;
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
  const slim = extracted ? extractedRowToNextActionInput(extracted, row.lease_jurisdiction) : null;
  const fromExtracted = slim ? computeAllLeaseActionsInPriorityOrder(slim) : [];
  if (fromExtracted.length > 0) {
    return fromExtracted;
  }
  return [nextFallback];
}

function resultToUpcomingItem(r: LeaseNextActionResult, displayLocale: string): DashboardUpcomingActionItem {
  return {
    label: nextActionDisplayLabel(r),
    dueLabel: formatNextActionDueLabel(r, displayLocale),
    severity: severityFromUrgency(r.urgency_level),
    actionDate: r.action_date,
    daysRemaining: r.days_remaining,
  };
}

export function buildDashboardData(leaseRows: LeaseWithExtracted[], displayLocale: string): DashboardData {
  const pendingReviews = leaseRows.filter((row) => row.review_status === "needs_review").length;

  const metrics: DashboardMetrics = {
    totalLeases: leaseRows.length,
    criticalActionsDue: leaseRows.filter((row) => {
      const extracted = normalizedExtracted(row);
      const expiryIso = extracted
        ? effectiveExpiryDate({ ...extracted, lease_jurisdiction: row.lease_jurisdiction })
        : null;
      if (leaseTermStatusFromExpiryDate(expiryIso) === "expired") {
        return false;
      }
      return isLeaseCriticalActionDue(effectiveLeaseNextAction(row, extracted));
    }).length,
    highRiskLeases: leaseRows.filter((row) => row.overall_risk === "high").length,
    pendingReviews,
  };

  const leases: DashboardLeaseRow[] = leaseRows.map((row) => {
    const extracted = normalizedExtracted(row);
    const expiryDate = extracted
      ? effectiveExpiryDate({ ...extracted, lease_jurisdiction: row.lease_jurisdiction })
      : null;
    const termStatus = leaseTermStatusFromExpiryDate(expiryDate);

    if (termStatus === "expired") {
      return {
        id: row.id,
        propertyName: row.property_name,
        propertyType: row.property_type,
        leaseJurisdiction: row.lease_jurisdiction,
        termStatus,
        expiryDate,
        nextCriticalAction: "—",
        actionType: null,
        actionDate: null,
        daysRemaining: null,
        urgencyLevel: null,
        riskLevel: row.overall_risk,
        extractionStatus: row.extraction_status,
        reviewStatus: row.review_status,
        allActionsInPriorityOrder: [],
      };
    }

    const next = effectiveLeaseNextAction(row, extracted);
    const allActionsInPriorityOrder: DashboardUpcomingActionItem[] = next
      ? allActionResultsForRow(row, next).map((r) => resultToUpcomingItem(r, displayLocale))
      : [];

    return {
      id: row.id,
      propertyName: row.property_name,
      propertyType: row.property_type,
      leaseJurisdiction: row.lease_jurisdiction,
      termStatus,
      expiryDate,
      nextCriticalAction: next ? nextActionDisplayLabel(next) : "—",
      actionType: next?.action_type ?? null,
      actionDate: next?.action_date ?? null,
      daysRemaining: next?.days_remaining ?? null,
      urgencyLevel: next?.urgency_level ?? null,
      riskLevel: row.overall_risk,
      extractionStatus: row.extraction_status,
      reviewStatus: row.review_status,
      allActionsInPriorityOrder: allActionsInPriorityOrder,
    };
  });

  const reviewQueue: DashboardReviewQueueItem[] = leaseRows
    .filter((row) => row.review_status === "needs_review")
    .map((row) => {
      const pr: LeaseReviewPriority = row.review_priority ?? "low";
      return {
        leaseId: row.id,
        propertyName: row.property_name,
        affectedFields: reviewAffectedFieldsFromDb(row.review_affected_fields),
        reason: row.review_reason,
        priority: pr,
      };
    })
    .sort((a, b) => {
      const pr = reviewPriorityRank(a.priority) - reviewPriorityRank(b.priority);
      if (pr !== 0) {
        return pr;
      }
      return a.propertyName.localeCompare(b.propertyName, undefined, { sensitivity: "base" });
    });

  return { metrics, leases, reviewQueue };
}
