"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { postLeaseAnalyse } from "@/lib/lease/post-lease-analyse";

type LeaseStructuredAnalyseKickoffProps = Readonly<{
  leaseId: string;
  /** When true, runs `/api/analyse` (e.g. PDF extraction finished but structured fields not written yet). */
  enabled: boolean;
}>;

/**
 * After text extraction, OpenAI structured analysis runs via `/api/analyse`. This client bridge triggers it
 * and refreshes server components when analyse succeeds.
 */
export function LeaseStructuredAnalyseKickoff({ leaseId, enabled }: LeaseStructuredAnalyseKickoffProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<"idle" | "running" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setPhase("idle");
      setErrorMessage(null);
      return;
    }

    let cancelled = false;

    setPhase("running");
    setErrorMessage(null);

    void (async () => {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        if (!cancelled) {
          setPhase("error");
          setErrorMessage("You are not signed in.");
        }
        return;
      }

      const result = await postLeaseAnalyse(session.access_token, leaseId);
      if (cancelled) {
        return;
      }

      if (result.ok) {
        setPhase("idle");
        router.refresh();
        return;
      }

      setPhase("error");
      setErrorMessage(result.error);
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, leaseId, retryKey, router]);

  if (!enabled) {
    return null;
  }

  if (phase === "running") {
    return (
      <div className="mb-6 flex items-center gap-3 rounded-xl border border-sky-200 bg-sky-50/90 px-4 py-3 text-sm text-sky-950">
        <span
          className="inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-sky-300 border-t-sky-800"
          aria-hidden
        />
        <span>Running AI structured extraction (dates, obligations, snippets)…</span>
      </div>
    );
  }

  if (phase === "error" && errorMessage) {
    return (
      <div className="mb-6 space-y-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <p className="font-medium">Structured extraction did not complete.</p>
        <p className="text-amber-900/90">{errorMessage}</p>
        <p className="text-xs text-amber-800/80">
          Confirm <code className="rounded bg-amber-100/80 px-1">OPENAI_API_KEY</code> is set in{" "}
          <code className="rounded bg-amber-100/80 px-1">.env.local</code> and restart{" "}
          <code className="rounded bg-amber-100/80 px-1">npm run dev</code>. In DevTools → Network, inspect{" "}
          <code className="rounded bg-amber-100/80 px-1">/api/analyse</code>.
        </p>
        <button
          type="button"
          onClick={() => setRetryKey((k) => k + 1)}
          className="rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-800"
        >
          Retry structured extraction
        </button>
      </div>
    );
  }

  return null;
}
