"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { usePathname } from "next/navigation";

import {
  defaultDashboardPortfolioFilters,
  type DashboardPortfolioFilterState,
} from "@/lib/dashboard/filter-dashboard-leases";

type DashboardPortfolioFiltersContextValue = Readonly<{
  filters: DashboardPortfolioFilterState;
  setFilters: Dispatch<SetStateAction<DashboardPortfolioFilterState>>;
  resetFilters: () => void;
}>;

const DashboardPortfolioFiltersContext = createContext<DashboardPortfolioFiltersContextValue | null>(null);

export function DashboardPortfolioFiltersProvider({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  const [filters, setFilters] = useState<DashboardPortfolioFilterState>(defaultDashboardPortfolioFilters);

  useEffect(() => {
    if (pathname !== "/dashboard") {
      setFilters(defaultDashboardPortfolioFilters);
    }
  }, [pathname]);

  const resetFilters = useCallback(() => {
    setFilters(defaultDashboardPortfolioFilters);
  }, []);

  const value = useMemo(
    () => ({
      filters,
      setFilters,
      resetFilters,
    }),
    [filters, resetFilters],
  );

  return (
    <DashboardPortfolioFiltersContext.Provider value={value}>{children}</DashboardPortfolioFiltersContext.Provider>
  );
}

export function useDashboardPortfolioFilters(): DashboardPortfolioFiltersContextValue {
  const ctx = useContext(DashboardPortfolioFiltersContext);
  if (!ctx) {
    throw new Error("useDashboardPortfolioFilters must be used within DashboardPortfolioFiltersProvider");
  }
  return ctx;
}
