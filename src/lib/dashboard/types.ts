import type { ExtractionStatus, OverallRisk } from "@/lib/supabase/database.types";

/** One row for the portfolio table (client-safe / serializable). */
export type DashboardLeaseRow = Readonly<{
  id: string;
  propertyName: string;
  nextCriticalAction: string;
  daysRemaining: number | null;
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
  title: string;
  dueLabel: string;
  severity: "info" | "warning" | "critical";
}>;

export type DashboardData = Readonly<{
  metrics: DashboardMetrics;
  leases: DashboardLeaseRow[];
  alerts: DashboardAlertRow[];
}>;

/** Pending alert row enriched with property name (avoids fragile PostgREST embeds). */
export type DashboardAlertSourceRow = Readonly<{
  id: string;
  alert_type: string;
  trigger_date: string;
  event_kind: string | null;
  event_date: string | null;
  horizon_days: number | null;
  lease_id: string;
  property_name: string;
}>;
