"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

import { createClient } from "@/lib/supabase/client";
import { needsStructuredAnalyse } from "@/lib/lease/needs-structured-analyse";
import { postLeaseAnalyse } from "@/lib/lease/post-lease-analyse";

const POLL_MS = 3000;

type DashboardLeasePipelineProps = Readonly<{
  /** Lease IDs that are still moving through upload / extract / analyse */
  pipelineLeaseIds: string[];
}>;

/**
 * Polls Supabase and kicks `/api/extract` and `/api/analyse` so the dashboard stays fresh after upload
 * without visiting the legacy processing page.
 */
export function DashboardLeasePipeline({ pipelineLeaseIds }: DashboardLeasePipelineProps) {
  const router = useRouter();
  const extractInFlight = useRef(new Set<string>());
  const analyseInFlight = useRef(new Set<string>());

  const tick = useCallback(async () => {
    if (pipelineLeaseIds.length === 0) {
      return;
    }

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      return;
    }

    const { data: rows, error } = await supabase
      .from("leases")
      .select("id, extraction_status")
      .in("id", pipelineLeaseIds);

    if (error || !rows?.length) {
      return;
    }

    let didKick = false;

    for (const row of rows) {
      if (row.extraction_status === "extracting" && !extractInFlight.current.has(row.id)) {
        extractInFlight.current.add(row.id);
        try {
          const res = await fetch("/api/extract", {
            method: "POST",
            credentials: "same-origin",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ leaseId: row.id }),
          });
          if (res.ok) {
            didKick = true;
          }
        } finally {
          extractInFlight.current.delete(row.id);
        }
      }

      if (row.extraction_status === "analysing" && !analyseInFlight.current.has(row.id)) {
        const { data: ed } = await supabase
          .from("extracted_data")
          .select("raw_text, ambiguous_language, manual_review_recommended")
          .eq("lease_id", row.id)
          .maybeSingle();

        if (!needsStructuredAnalyse("analysing", ed)) {
          continue;
        }

        analyseInFlight.current.add(row.id);
        try {
          const result = await postLeaseAnalyse(session.access_token, row.id);
          if (result.ok) {
            didKick = true;
          }
        } finally {
          analyseInFlight.current.delete(row.id);
        }
      }
    }

    if (didKick) {
      router.refresh();
    }
  }, [pipelineLeaseIds, router]);

  useEffect(() => {
    if (pipelineLeaseIds.length === 0) {
      return;
    }

    void tick();
    const id = window.setInterval(() => {
      void tick();
    }, POLL_MS);

    return () => window.clearInterval(id);
  }, [pipelineLeaseIds, tick]);

  return null;
}
