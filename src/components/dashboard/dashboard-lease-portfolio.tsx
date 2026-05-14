"use client";

import { useCallback, useMemo, useState } from "react";

import { LeasePortfolioTable } from "@/components/dashboard/lease-portfolio-table";
import {
  countActivePortfolioFilters,
  defaultDashboardPortfolioFilters,
  filterDashboardLeases,
  type DashboardPortfolioFilterState,
  type DueWithinHorizon,
} from "@/lib/dashboard/filter-dashboard-leases";
import type { DashboardLeaseRow } from "@/lib/dashboard/types";
import { PROPERTY_TYPES } from "@/lib/lease/property-types";
import type { ExtractionStatus, OverallRisk } from "@/lib/supabase/database.types";

const RISK_OPTIONS: readonly { value: OverallRisk; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

const EXTRACTION_OPTIONS: readonly { value: ExtractionStatus; label: string }[] = [
  { value: "uploading", label: "Uploading" },
  { value: "extracting", label: "Extracting" },
  { value: "analysing", label: "Analysing" },
  { value: "calculating_risks", label: "Calculating risks" },
  { value: "complete", label: "Complete" },
  { value: "failed", label: "Failed" },
];

const DUE_WITHIN_OPTIONS: readonly { value: DueWithinHorizon; label: string }[] = [
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
  { value: 180, label: "180 days" },
];

const PROPERTY_TYPE_FILTER_OPTIONS = [
  ...PROPERTY_TYPES.map((p) => ({ value: p.value, label: p.label })),
  { value: "unknown", label: "Unknown" },
] as const;

const selectClassName =
  "w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm ring-1 ring-slate-900/5 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400";

const labelClassName = "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500";

type DashboardLeasePortfolioProps = Readonly<{
  leases: readonly DashboardLeaseRow[];
}>;

export function DashboardLeasePortfolio({ leases }: DashboardLeasePortfolioProps) {
  const [filters, setFilters] = useState<DashboardPortfolioFilterState>(defaultDashboardPortfolioFilters);

  const filtered = useMemo(() => filterDashboardLeases(leases, filters), [leases, filters]);

  const activeCount = useMemo(() => countActivePortfolioFilters(filters), [filters]);

  const clearFilters = useCallback(() => {
    setFilters(defaultDashboardPortfolioFilters);
  }, []);

  return (
    <div className="space-y-4">
      <section
        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
        aria-label="Portfolio filters"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Filter and search</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Narrow the portfolio table. The horizon filter uses the next dated critical action (same column as the
              table); overdue items are included.
            </p>
          </div>
          {activeCount > 0 ? (
            <button
              type="button"
              onClick={clearFilters}
              className="shrink-0 self-start rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-100 sm:self-auto"
            >
              Clear filters ({activeCount})
            </button>
          ) : null}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <div className="sm:col-span-2 lg:col-span-3 xl:col-span-2">
            <label htmlFor="dashboard-lease-search" className={labelClassName}>
              Property name
            </label>
            <input
              id="dashboard-lease-search"
              type="search"
              autoComplete="off"
              placeholder="Search by name…"
              value={filters.searchQuery}
              onChange={(e) => setFilters((prev) => ({ ...prev, searchQuery: e.target.value }))}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm ring-1 ring-slate-900/5 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </div>
          <div>
            <label htmlFor="dashboard-risk-filter" className={labelClassName}>
              Risk level
            </label>
            <select
              id="dashboard-risk-filter"
              className={selectClassName}
              value={filters.riskLevel ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setFilters((prev) => ({
                  ...prev,
                  riskLevel: v === "" ? null : (v as OverallRisk),
                }));
              }}
            >
              <option value="">All risks</option>
              {RISK_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="dashboard-property-type-filter" className={labelClassName}>
              Property type
            </label>
            <select
              id="dashboard-property-type-filter"
              className={selectClassName}
              value={filters.propertyType ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setFilters((prev) => ({
                  ...prev,
                  propertyType: v === "" ? null : v,
                }));
              }}
            >
              <option value="">All types</option>
              {PROPERTY_TYPE_FILTER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="dashboard-extraction-filter" className={labelClassName}>
              Processing status
            </label>
            <select
              id="dashboard-extraction-filter"
              className={selectClassName}
              value={filters.extractionStatus ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setFilters((prev) => ({
                  ...prev,
                  extractionStatus: v === "" ? null : (v as ExtractionStatus),
                }));
              }}
            >
              <option value="">All statuses</option>
              {EXTRACTION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="dashboard-due-within-filter" className={labelClassName}>
              Action due within
            </label>
            <select
              id="dashboard-due-within-filter"
              className={selectClassName}
              value={filters.dueWithinDays ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setFilters((prev) => ({
                  ...prev,
                  dueWithinDays: v === "" ? null : (Number(v) as DueWithinHorizon),
                }));
              }}
            >
              <option value="">Any time</option>
              {DUE_WITHIN_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="mt-3 text-xs text-slate-500" aria-live="polite">
          Showing <span className="font-semibold text-slate-700">{filtered.length}</span> of{" "}
          <span className="font-semibold text-slate-700">{leases.length}</span> lease
          {leases.length === 1 ? "" : "s"}
        </p>
      </section>

      <LeasePortfolioTable
        leases={filtered}
        noMatchesFromFilters={leases.length > 0 && filtered.length === 0}
        onClearFilters={activeCount > 0 ? clearFilters : undefined}
      />
    </div>
  );
}
