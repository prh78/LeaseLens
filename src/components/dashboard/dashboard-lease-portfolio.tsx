"use client";

import { useMemo } from "react";

import { useDashboardPortfolioFilters } from "@/components/dashboard/dashboard-portfolio-filters-context";
import { LeasePortfolioTable } from "@/components/dashboard/lease-portfolio-table";
import {
  countActivePortfolioFilters,
  filterDashboardLeases,
} from "@/lib/dashboard/filter-dashboard-leases";
import type { DashboardLeaseRow } from "@/lib/dashboard/types";

type DashboardLeasePortfolioProps = Readonly<{
  leases: readonly DashboardLeaseRow[];
}>;

export function DashboardLeasePortfolio({ leases }: DashboardLeasePortfolioProps) {
  const { filters, resetFilters } = useDashboardPortfolioFilters();

  const filtered = useMemo(() => filterDashboardLeases(leases, filters), [leases, filters]);

  const activeCount = useMemo(() => countActivePortfolioFilters(filters), [filters]);

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500" aria-live="polite">
        Showing <span className="font-semibold text-slate-700">{filtered.length}</span> of{" "}
        <span className="font-semibold text-slate-700">{leases.length}</span> lease
        {leases.length === 1 ? "" : "s"}
        {activeCount > 0 ? (
          <>
            {" "}
            ·{" "}
            <button
              type="button"
              onClick={resetFilters}
              className="font-semibold text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
            >
              Clear filters
            </button>
          </>
        ) : null}
      </p>

      <LeasePortfolioTable
        leases={filtered}
        noMatchesFromFilters={leases.length > 0 && filtered.length === 0}
        onClearFilters={activeCount > 0 ? resetFilters : undefined}
      />
    </div>
  );
}
