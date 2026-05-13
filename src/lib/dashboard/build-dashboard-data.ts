import { computeNextCriticalAction, hasCriticalActionWithin90Days } from "@/lib/dashboard/next-critical-action";
import type { DashboardAlertRow, DashboardData, DashboardLeaseRow, DashboardMetrics } from "@/lib/dashboard/types";
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

function severityForAlert(
  horizon: number | null,
  triggerIso: string,
): "info" | "warning" | "critical" {
  const t = new Date(triggerIso).getTime();
  if (Number.isNaN(t)) {
    return "info";
  }
  const days = Math.ceil((t - Date.now()) / 86_400_000);
  if (days <= 7) {
    return "critical";
  }
  if (days <= 30 || horizon === 30 || horizon === 7) {
    return "warning";
  }
  return "info";
}

function formatTriggerDueLabel(triggerIso: string): string {
  const t = new Date(triggerIso);
  if (Number.isNaN(t.getTime())) {
    return triggerIso;
  }
  const now = new Date();
  const diffMs = t.getTime() - now.getTime();
  const days = Math.ceil(diffMs / 86_400_000);
  if (days <= 0) {
    return "Due now";
  }
  if (days === 1) {
    return "In 1 day";
  }
  if (days < 14) {
    return `In ${days} days`;
  }
  return t.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

type AlertWithLease = {
  id: string;
  alert_type: string;
  trigger_date: string;
  event_kind: string | null;
  event_date: string | null;
  horizon_days: number | null;
  lease_id: string;
  leases: { property_name: string } | { property_name: string }[] | null;
};

function leaseNameFromJoin(leases: AlertWithLease["leases"]): string {
  if (!leases) {
    return "Lease";
  }
  const row = Array.isArray(leases) ? leases[0] : leases;
  return row?.property_name ?? "Lease";
}

export function buildDashboardData(
  leaseRows: LeaseWithExtracted[],
  alertRows: AlertWithLease[],
): DashboardData {
  const metrics: DashboardMetrics = {
    totalLeases: leaseRows.length,
    criticalActionsDue: leaseRows.filter((row) => hasCriticalActionWithin90Days(normalizedExtracted(row))).length,
    highRiskLeases: leaseRows.filter((row) => row.overall_risk === "high").length,
  };

  const leases: DashboardLeaseRow[] = leaseRows.map((row) => {
    const extracted = normalizedExtracted(row);
    const next = computeNextCriticalAction(extracted);
    return {
      id: row.id,
      propertyName: row.property_name,
      nextCriticalAction: next?.label ?? "—",
      daysRemaining: next?.daysRemaining ?? null,
      riskLevel: row.overall_risk,
      extractionStatus: row.extraction_status,
    };
  });

  const alerts: DashboardAlertRow[] = alertRows.map((a) => ({
    id: a.id,
    title: `${leaseNameFromJoin(a.leases)} — ${a.alert_type}`,
    dueLabel: formatTriggerDueLabel(a.trigger_date),
    severity: severityForAlert(a.horizon_days, a.trigger_date),
  }));

  return { metrics, leases, alerts };
}
