"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const REFRESH_MS = 10_000;

type DashboardProcessingRefreshProps = Readonly<{
  /** When true, refetches server data on an interval so completed leases replace rows without a manual reload. */
  enabled: boolean;
}>;

export function DashboardProcessingRefresh({ enabled }: DashboardProcessingRefreshProps) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const id = window.setInterval(() => {
      router.refresh();
    }, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [enabled, router]);

  return null;
}
