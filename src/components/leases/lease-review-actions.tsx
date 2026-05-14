"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { createClient } from "@/lib/supabase/client";

type LeaseReviewActionsProps = Readonly<{
  leaseId: string;
}>;

const btnBase =
  "inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-xs font-semibold shadow-sm ring-1 ring-inset transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 disabled:opacity-50";

export function LeaseReviewActions({ leaseId }: LeaseReviewActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<"verified" | "unresolved" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    async (reviewStatus: "verified" | "unresolved") => {
      setError(null);
      setBusy(reviewStatus);
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) {
          setError("You must be signed in.");
          return;
        }

        const res = await fetch(`/api/v1/leases/${encodeURIComponent(leaseId)}/review`, {
          method: "PATCH",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ reviewStatus }),
        });
        const payload = (await res.json()) as { error?: string };
        if (!res.ok) {
          setError(payload.error ?? "Could not update review status.");
          return;
        }
        router.refresh();
      } finally {
        setBusy(null);
      }
    },
    [leaseId, router],
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={busy !== null}
        onClick={() => void submit("verified")}
        className={`${btnBase} bg-emerald-600 text-white ring-emerald-600/20 hover:bg-emerald-700`}
      >
        {busy === "verified" ? "Saving…" : "Mark verified"}
      </button>
      <button
        type="button"
        disabled={busy !== null}
        onClick={() => void submit("unresolved")}
        className={`${btnBase} bg-white text-slate-800 ring-slate-200 hover:bg-slate-50`}
      >
        {busy === "unresolved" ? "Saving…" : "Mark unresolved"}
      </button>
      {error ? <p className="w-full text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
