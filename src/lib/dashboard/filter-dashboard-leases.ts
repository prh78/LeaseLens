import type { DashboardLeaseRow } from "@/lib/dashboard/types";
import type { LeaseJurisdiction } from "@/lib/lease/jurisdiction/types";
import type { ExtractionStatus, OverallRisk } from "@/lib/supabase/database.types";

export type DueWithinHorizon = 30 | 90 | 180;

export type DashboardPortfolioFilterState = Readonly<{
  searchQuery: string;
  riskLevel: OverallRisk | null;
  /** `null` = all property types. Otherwise matches `leases.property_type`. */
  propertyType: string | null;
  extractionStatus: ExtractionStatus | null;
  dueWithinDays: DueWithinHorizon | null;
  /** `null` = all region packs. */
  leaseJurisdiction: LeaseJurisdiction | null;
}>;

export const defaultDashboardPortfolioFilters: DashboardPortfolioFilterState = {
  searchQuery: "",
  riskLevel: null,
  propertyType: null,
  extractionStatus: null,
  dueWithinDays: null,
  leaseJurisdiction: null,
};

export function filterDashboardLeases(
  leases: readonly DashboardLeaseRow[],
  filters: DashboardPortfolioFilterState,
): DashboardLeaseRow[] {
  const q = filters.searchQuery.trim().toLowerCase();

  return leases.filter((row) => {
    if (q && !row.propertyName.toLowerCase().includes(q)) {
      return false;
    }
    if (filters.riskLevel && row.riskLevel !== filters.riskLevel) {
      return false;
    }
    if (filters.propertyType != null && row.propertyType !== filters.propertyType) {
      return false;
    }
    if (filters.extractionStatus && row.extractionStatus !== filters.extractionStatus) {
      return false;
    }
    if (filters.dueWithinDays != null) {
      const d = row.daysRemaining;
      if (d === null) {
        return false;
      }
      if (d > filters.dueWithinDays) {
        return false;
      }
    }
    if (filters.leaseJurisdiction != null && row.leaseJurisdiction !== filters.leaseJurisdiction) {
      return false;
    }
    return true;
  });
}

export function countActivePortfolioFilters(filters: DashboardPortfolioFilterState): number {
  let n = 0;
  if (filters.searchQuery.trim()) {
    n += 1;
  }
  if (filters.riskLevel) {
    n += 1;
  }
  if (filters.propertyType != null) {
    n += 1;
  }
  if (filters.extractionStatus) {
    n += 1;
  }
  if (filters.dueWithinDays != null) {
    n += 1;
  }
  if (filters.leaseJurisdiction != null) {
    n += 1;
  }
  return n;
}
