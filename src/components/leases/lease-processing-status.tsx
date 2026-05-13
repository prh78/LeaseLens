"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { postLeaseAnalyse } from "@/lib/lease/post-lease-analyse";
import { needsStructuredAnalyse } from "@/lib/lease/needs-structured-analyse";
import type { ExtractionStatus } from "@/lib/supabase/database.types";

type LeaseRow = {
  id: string;
  property_name: string;
  extraction_status: ExtractionStatus;
  extraction_error: string | null;
};

const POLL_MS = 3000;

export function LeaseProcessingStatus() {
  const searchParams = useSearchParams();
  const leaseId = searchParams.get("lease_id");

  const [lease, setLease] = useState<LeaseRow | null>(null);
  const [needsStructured, setNeedsStructured] = useState(false);
  const [analysePhase, setAnalysePhase] = useState<"idle" | "running" | "error">("idle");
  const [analyseError, setAnalyseError] = useState<string | null>(null);
  const [analyseAttempt, setAnalyseAttempt] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const extractKickoffDone = useRef(false);
  const loadedLeaseId = lease?.id ?? null;
  const leaseExtractStatus = lease?.extraction_status;

  const fetchLease = useCallback(async () => {
    if (!leaseId) {
      return;
    }

    const supabase = createClient();
    const { data, error } = await supabase
      .from("leases")
      .select("id, property_name, extraction_status, extraction_error")
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

    if (data.extraction_status === "complete" && leaseId) {
      const { data: ed } = await supabase
        .from("extracted_data")
        .select("raw_text, ambiguous_language, manual_review_recommended")
        .eq("lease_id", leaseId)
        .maybeSingle();
      setNeedsStructured(needsStructuredAnalyse(data.extraction_status, ed));
    } else {
      setNeedsStructured(false);
    }
  }, [leaseId]);

  useEffect(() => {
    extractKickoffDone.current = false;
  }, [leaseId]);

  useEffect(() => {
    if (!leaseId) {
      return;
    }
    void fetchLease();
  }, [leaseId, fetchLease]);

  useEffect(() => {
    if (!leaseId || !lease || lease.extraction_status !== "pending" || extractKickoffDone.current) {
      return;
    }

    extractKickoffDone.current = true;

    void (async () => {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        extractKickoffDone.current = false;
        return;
      }

      try {
        await fetch("/api/extract", {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ leaseId }),
        });
      } finally {
        void fetchLease();
      }
    })();
  }, [lease, leaseId, fetchLease]);

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

  useEffect(() => {
    if (!needsStructured) {
      setAnalysePhase("idle");
      setAnalyseError(null);
    }
  }, [needsStructured]);

  useEffect(() => {
    if (
      !leaseId ||
      !loadedLeaseId ||
      loadedLeaseId !== leaseId ||
      leaseExtractStatus !== "complete" ||
      !needsStructured
    ) {
      return;
    }

    let cancelled = false;
    setAnalysePhase("running");
    setAnalyseError(null);

    void (async () => {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        if (!cancelled) {
          setAnalysePhase("error");
          setAnalyseError("You are not signed in.");
        }
        return;
      }

      const result = await postLeaseAnalyse(session.access_token, leaseId);
      if (cancelled) {
        return;
      }

      if (result.ok) {
        await fetchLease();
        setAnalysePhase("idle");
        return;
      }

      setAnalysePhase("error");
      setAnalyseError(result.error);
    })();

    return () => {
      cancelled = true;
    };
  }, [leaseId, loadedLeaseId, leaseExtractStatus, needsStructured, analyseAttempt, fetchLease]);

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
    pending: "Queued — starting text extraction.",
    processing: "Reading your PDF and extracting text…",
    complete:
      needsStructured || analysePhase === "running"
        ? "Text extraction finished. Running AI structured extraction for dates and clauses…"
        : analysePhase === "error"
          ? "Text extraction finished. Structured extraction encountered an error (see below)."
          : "Text extraction and structured analysis finished. Open the lease detail page to review dates and clauses.",
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

      {lease.extraction_status === "complete" && analysePhase === "running" ? (
        <div className="flex items-center gap-3 rounded-xl border border-sky-200 bg-sky-50/90 px-4 py-3 text-sm text-sky-950">
          <span
            className="inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-sky-300 border-t-sky-800"
            aria-hidden
          />
          Running AI structured extraction (OpenAI)…
        </div>
      ) : null}

      {lease.extraction_status === "complete" && analysePhase === "error" && analyseError ? (
        <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-medium">Structured extraction failed.</p>
          <p className="text-amber-900/90">{analyseError}</p>
          <p className="text-xs text-amber-800/80">
            Set <code className="rounded bg-amber-100/80 px-1">OPENAI_API_KEY</code> in{" "}
            <code className="rounded bg-amber-100/80 px-1">.env.local</code> and restart the dev server. Inspect{" "}
            <code className="rounded bg-amber-100/80 px-1">/api/analyse</code> in the Network tab.
          </p>
          <button
            type="button"
            onClick={() => setAnalyseAttempt((n) => n + 1)}
            className="rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-800"
          >
            Retry structured extraction
          </button>
        </div>
      ) : null}

      {lease.extraction_status === "complete" ? (
        <Link
          href={`/lease/${lease.id}`}
          className="inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          View lease detail
        </Link>
      ) : null}

      {lease.extraction_status === "failed" && lease.extraction_error ? (
        <p className="rounded-lg border border-red-100 bg-red-50/80 px-3 py-2 text-sm text-red-800">
          {lease.extraction_error}
        </p>
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
