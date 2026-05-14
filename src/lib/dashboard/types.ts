import type { LeaseTermStatus } from "@/lib/lease/lease-term-status";
import type { ExtractionStatus, LeaseNextActionType, LeaseNextActionUrgency, OverallRisk } from "@/lib/supabase/database.types";

export type DashboardUpcomingActionItem = Readonly<{
  label: string;
  dueLabel: string;
  severity: "info" | "warning" | "critical";
  actionDate: string | null;
  daysRemaining: number | null;
}>;

/** One row for the portfolio table (client-safe / serializable). */
export type DashboardLeaseRow = Readonly<{
  id: string;
  propertyName: string;
  /** From `extracted_data.expiry_date` vs today (UTC calendar). */
  termStatus: LeaseTermStatus;
  /** ISO calendar date `YYYY-MM-DD` from `extracted_data`, or null when unknown / not extracted. */
  expiryDate: string | null;
  nextCriticalAction: string;
  actionType: LeaseNextActionType | null;
  actionDate: string | null;
  daysRemaining: number | null;
  urgencyLevel: LeaseNextActionUrgency | null;
  riskLevel: OverallRisk;
  extractionStatus: ExtractionStatus;
  /** Ordered actions (same order as portfolio expand list). Empty when none. */
  allActionsInPriorityOrder: readonly DashboardUpcomingActionItem[];
}>;

export type DashboardMetrics = Readonly<{
  totalLeases: number;
  criticalActionsDue: number;
  highRiskLeases: number;
}>;

export type DashboardData = Readonly<{
  metrics: DashboardMetrics;
  leases: DashboardLeaseRow[];
}>;
