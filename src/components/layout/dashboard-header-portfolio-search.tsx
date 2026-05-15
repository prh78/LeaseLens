"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

import { useDashboardPortfolioFilters } from "@/components/dashboard/dashboard-portfolio-filters-context";
import {
  DASHBOARD_PORTFOLIO_DUE_WITHIN_OPTIONS,
  DASHBOARD_PORTFOLIO_EXTRACTION_OPTIONS,
  DASHBOARD_PORTFOLIO_JURISDICTION_OPTIONS,
  DASHBOARD_PORTFOLIO_PROPERTY_TYPE_OPTIONS,
  DASHBOARD_PORTFOLIO_RISK_OPTIONS,
  dashboardPortfolioLabelClassName,
  dashboardPortfolioSelectClassName,
} from "@/lib/dashboard/dashboard-portfolio-filter-fields";
import { countActivePortfolioFilters } from "@/lib/dashboard/filter-dashboard-leases";
import type { DueWithinHorizon } from "@/lib/dashboard/filter-dashboard-leases";
import type { LeaseJurisdiction } from "@/lib/lease/jurisdiction/types";
import type { ExtractionStatus, OverallRisk } from "@/lib/supabase/database.types";

function SearchGlyph() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="size-4 shrink-0 text-slate-400" aria-hidden>
      <path
        fillRule="evenodd"
        d="M9 3.5a5.5 5.5 0 1 0 3.23 9.99l3.86 3.86a.75.75 0 1 0 1.06-1.06l-3.86-3.86A5.5 5.5 0 0 0 9 3.5ZM4.5 9a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function SlidersGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="size-4 shrink-0 text-slate-600"
      aria-hidden
    >
      <path d="M4 6h16M7 12h10M10 18h4" />
    </svg>
  );
}

/**
 * Compact search next to the LeaseLens mark; expands to show portfolio filters (dashboard only).
 */
export function DashboardHeaderPortfolioSearch() {
  const baseId = useId();
  const { filters, setFilters, resetFilters } = useDashboardPortfolioFilters();
  const [panelOpen, setPanelOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const activeFilterCount = countActivePortfolioFilters(filters);
  const hasExtraFilters =
    filters.riskLevel != null ||
    filters.propertyType != null ||
    filters.extractionStatus != null ||
    filters.dueWithinDays != null ||
    filters.leaseJurisdiction != null;

  const closePanel = useCallback(() => {
    setPanelOpen(false);
  }, []);

  useEffect(() => {
    if (!panelOpen) {
      return;
    }
    const onPointerDown = (e: PointerEvent) => {
      const el = rootRef.current;
      if (el && !el.contains(e.target as Node)) {
        setPanelOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPanelOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [panelOpen]);

  return (
    <div ref={rootRef} className="relative min-w-0 flex-1 max-w-xl">
      <div
        className={`flex h-9 w-full min-w-0 items-stretch overflow-hidden rounded-lg border bg-white shadow-sm ring-1 ring-slate-900/5 transition ${
          panelOpen ? "border-slate-300 ring-2 ring-slate-400/30" : "border-slate-200"
        }`}
      >
        <div className="flex shrink-0 items-center pl-2.5" aria-hidden>
          <SearchGlyph />
        </div>
        <input
          id={`${baseId}-search`}
          type="search"
          autoComplete="off"
          placeholder="Search properties…"
          value={filters.searchQuery}
          onChange={(e) => setFilters((prev) => ({ ...prev, searchQuery: e.target.value }))}
          onFocus={() => setPanelOpen(true)}
          className="min-w-0 flex-1 border-0 bg-transparent py-0 pl-1.5 pr-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0"
          aria-haspopup="true"
          aria-controls={panelOpen ? `${baseId}-filter-panel` : undefined}
        />
        <button
          type="button"
          onClick={() => setPanelOpen((o) => !o)}
          className="relative flex shrink-0 items-center border-l border-slate-200/90 bg-slate-50/80 px-2.5 hover:bg-slate-100"
          aria-expanded={panelOpen}
          aria-controls={`${baseId}-filter-panel`}
          title="More filters"
        >
          <SlidersGlyph />
          <span className="sr-only">Toggle filter panel</span>
          {activeFilterCount > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-slate-900 px-1 text-[10px] font-bold leading-none text-white">
              {activeFilterCount > 9 ? "9+" : activeFilterCount}
            </span>
          ) : null}
        </button>
      </div>

      {panelOpen ? (
        <div
          id={`${baseId}-filter-panel`}
          role="region"
          aria-label="Portfolio filters"
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-[min(70vh,520px)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-xl ring-1 ring-slate-900/10 sm:p-5"
        >
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
            <p className="text-sm font-semibold text-slate-900">Filters</p>
            {activeFilterCount > 0 ? (
              <button
                type="button"
                onClick={() => {
                  resetFilters();
                }}
                className="shrink-0 text-xs font-semibold text-slate-600 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
              >
                Clear all
              </button>
            ) : null}
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={`${baseId}-risk`} className={dashboardPortfolioLabelClassName}>
                Risk level
              </label>
              <select
                id={`${baseId}-risk`}
                className={dashboardPortfolioSelectClassName}
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
                {DASHBOARD_PORTFOLIO_RISK_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={`${baseId}-ptype`} className={dashboardPortfolioLabelClassName}>
                Property type
              </label>
              <select
                id={`${baseId}-ptype`}
                className={dashboardPortfolioSelectClassName}
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
                {DASHBOARD_PORTFOLIO_PROPERTY_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={`${baseId}-ext`} className={dashboardPortfolioLabelClassName}>
                Processing status
              </label>
              <select
                id={`${baseId}-ext`}
                className={dashboardPortfolioSelectClassName}
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
                {DASHBOARD_PORTFOLIO_EXTRACTION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={`${baseId}-region`} className={dashboardPortfolioLabelClassName}>
                Region pack
              </label>
              <select
                id={`${baseId}-region`}
                className={dashboardPortfolioSelectClassName}
                value={filters.leaseJurisdiction ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setFilters((prev) => ({
                    ...prev,
                    leaseJurisdiction: v === "" ? null : (v as LeaseJurisdiction),
                  }));
                }}
              >
                <option value="">All regions</option>
                {DASHBOARD_PORTFOLIO_JURISDICTION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={`${baseId}-due`} className={dashboardPortfolioLabelClassName}>
                Action due within
              </label>
              <select
                id={`${baseId}-due`}
                className={dashboardPortfolioSelectClassName}
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
                {DASHBOARD_PORTFOLIO_DUE_WITHIN_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p className="mt-4 border-t border-slate-100 pt-3 text-xs leading-relaxed text-slate-500">
            The horizon filter uses the next dated critical action from the portfolio table; overdue items are included.
            {hasExtraFilters ? (
              <>
                {" "}
                <button
                  type="button"
                  className="font-semibold text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
                  onClick={() => {
                    setFilters((prev) => ({
                      ...prev,
                      riskLevel: null,
                      propertyType: null,
                      extractionStatus: null,
                      dueWithinDays: null,
                      leaseJurisdiction: null,
                    }));
                  }}
                >
                  Clear dropdown filters
                </button>{" "}
                (keeps name search).
              </>
            ) : null}
          </p>
        </div>
      ) : null}
    </div>
  );
}
