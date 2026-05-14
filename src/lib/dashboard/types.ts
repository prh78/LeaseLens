import type { ExtractionStatus, LeaseNextActionType, LeaseNextActionUrgency, OverallRisk } from "@/lib/supabase/database.types";

/** One row for the portfolio table (client-safe / serializable). */
export type DashboardLeaseRow = Readonly<{
  id: string;
  propertyName: string;
  nextCriticalAction: string;
  actionType: LeaseNextActionType | null;
  actionDate: string | null;
  daysRemaining: number | null;
  urgencyLevel: LeaseNextActionUrgency | null;
  riskLevel: OverallRisk;
  extractionStatus: ExtractionStatus;
}>;

export type DashboardMetrics = Readonly<{
  totalLeases: number;
  criticalActionsDue: number;
  highRiskLeases: number;
}>;

export type DashboardUpcomingActionItem = Readonly<{
  label: string;
  dueLabel: string;
  severity: "info" | "warning" | "critical";
  actionDate: string | null;
  daysRemaining: number | null;
}>;

export type DashboardAlertRow = Readonly<{
  id: string;
  leaseId: string;
  propertyName: string;
  title: string;
  dueLabel: string;
  severity: "info" | "warning" | "critical";
  /** Ordered extras after the summary (breaks → reviews → expiry → manual). First entry is shown collapsed. */
  allActionsInPriorityOrder: readonly DashboardUpcomingActionItem[];
}>;

export type DashboardData = Readonly<{
  metrics: DashboardMetrics;
  leases: DashboardLeaseRow[];
  alerts: DashboardAlertRow[];
}>;
