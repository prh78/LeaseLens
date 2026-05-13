"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import type { ExtractionStatus } from "@/lib/supabase/database.types";

type LeaseRow = {
  id: string;
  property_name: string;
  extraction_status: ExtractionStatus;
};

const POLL_MS = 3000;

export function LeaseProcessingStatus() {
  const searchParams = useSearchParams();
  const leaseId = searchParams.get("lease_id");

  const [lease, setLease] = useState<LeaseRow | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchLease = useCallback(async () => {
    if (!leaseId) {
      return;
    }

    const supabase = createClient();
    const { data, error } = await supabase
      .from("leases")
      .select("id, property_name, extraction_status")
      .eq("id", leaseId)
      .maybeSingle();

    if (error) {
      setLoadError(error.message);
      return;
    }

    if (!data) {
      setLoadError("We could not find that lease, or you do not have access.");
      return;
    }

    setLoadError(null);
    setLease(data);
  }, [leaseId]);

  useEffect(() => {
    if (!leaseId) {
      return;
    }
    void fetchLease();
  }, [leaseId, fetchLease]);

  useEffect(() => {
    if (!leaseId || !lease) {
      return;
    }
    if (lease.extraction_status === "complete" || lease.extraction_status === "failed") {
      return;
    }

    const id = window.setInterval(() => {
      void fetchLease();
    }, POLL_MS);

    return () => window.clearInterval(id);
  }, [lease, leaseId, fetchLease]);

  if (!leaseId) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Missing <code className="rounded bg-amber-100 px-1">lease_id</code>. Return to{" "}
        <Link href="/upload" className="font-medium underline">
          upload
        </Link>
        .
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
        {loadError}
      </div>
    );
  }

  if (!lease) {
    return (
      <div className="space-y-3" aria-busy="true">
        <div className="h-4 w-48 animate-pulse rounded bg-slate-200" />
        <div className="h-3 w-full max-w-md animate-pulse rounded bg-slate-100" />
      </div>
    );
  }

  const statusLabel: Record<ExtractionStatus, string> = {
    pending: "Queued — we will start extraction shortly.",
    processing: "Extracting key dates and clauses from your PDF…",
    complete: "Extraction finished. You can open the lease from your dashboard.",
    failed: "Extraction failed. Try uploading again or contact support.",
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{lease.property_name}</h2>
        <p className="mt-2 text-sm text-slate-600">{statusLabel[lease.extraction_status]}</p>
      </div>

      {lease.extraction_status === "pending" || lease.extraction_status === "processing" ? (
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <span
            className="inline-block size-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900"
            aria-hidden
          />
          Checking status every few seconds…
        </div>
      ) : null}

      {lease.extraction_status === "complete" ? (
        <Link
          href="/dashboard"
          className="inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Go to dashboard
        </Link>
      ) : null}

      {lease.extraction_status === "failed" ? (
        <Link
          href="/upload"
          className="inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Upload another lease
        </Link>
      ) : null}

      <p className="text-xs text-slate-400">
        Lease ID: <span className="font-mono text-slate-600">{lease.id}</span>
      </p>
    </div>
  );
}
