"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

const DEBOUNCE_MS = 1500;

/** Refetches dashboard server data when the tab becomes visible or the window regains focus (e.g. after editing a lease). */
export function DashboardVisibilityRefresh() {
  const router = useRouter();
  const lastRefreshAt = useRef(0);

  useEffect(() => {
    const refreshDebounced = () => {
      const now = Date.now();
      if (now - lastRefreshAt.current < DEBOUNCE_MS) {
        return;
      }
      lastRefreshAt.current = now;
      router.refresh();
    };

    const onVisibility = () => {
      if (document.visibilityState !== "visible") {
        return;
      }
      refreshDebounced();
    };

    const onWindowFocus = () => {
      refreshDebounced();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onWindowFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onWindowFocus);
    };
  }, [router]);

  return null;
}
