import { PROPERTY_TYPES } from "@/lib/lease/property-types";
import type { ExtractionStatus, OverallRisk } from "@/lib/supabase/database.types";

import type { DueWithinHorizon } from "@/lib/dashboard/filter-dashboard-leases";

export const DASHBOARD_PORTFOLIO_RISK_OPTIONS: readonly { value: OverallRisk; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

export const DASHBOARD_PORTFOLIO_EXTRACTION_OPTIONS: readonly { value: ExtractionStatus; label: string }[] = [
  { value: "uploading", label: "Uploading" },
  { value: "extracting", label: "Extracting" },
  { value: "analysing", label: "Analysing" },
  { value: "calculating_risks", label: "Calculating risks" },
  { value: "complete", label: "Complete" },
  { value: "failed", label: "Failed" },
];

export const DASHBOARD_PORTFOLIO_DUE_WITHIN_OPTIONS: readonly { value: DueWithinHorizon; label: string }[] = [
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
  { value: 180, label: "180 days" },
];

export const DASHBOARD_PORTFOLIO_PROPERTY_TYPE_OPTIONS = [
  ...PROPERTY_TYPES.map((p) => ({ value: p.value, label: p.label })),
  { value: "unknown", label: "Unknown" },
] as const;

export const dashboardPortfolioSelectClassName =
  "w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm ring-1 ring-slate-900/5 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400";

export const dashboardPortfolioLabelClassName =
  "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500";
