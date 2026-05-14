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

export type DashboardAlertRow = Readonly<{
  id: string;
  leaseId: string;
  title: string;
  dueLabel: string;
  severity: "info" | "warning" | "critical";
}>;

export type DashboardData = Readonly<{
  metrics: DashboardMetrics;
  leases: DashboardLeaseRow[];
  alerts: DashboardAlertRow[];
}>;
