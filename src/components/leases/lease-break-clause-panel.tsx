"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { snippetEvidenceForField } from "@/lib/lease/lease-detail-audit";
import {
  BREAK_CLAUSE_STATUS_LABEL,
  breakDatesFromExtracted,
  parseBreakClauseStatusMap,
  type BreakClauseStatus,
} from "@/lib/lease/break-clause-status";
import { breakNoticeDeadlineIso } from "@/lib/lease/compute-lease-next-action";
import { formatIsoDate, jsonSnippetMap } from "@/lib/lease/lease-detail";
import type { Json, Tables } from "@/lib/supabase/database.types";

type LeaseBreakClausePanelProps = Readonly<{
  leaseId: string;
  extracted: Tables<"extracted_data">;
}>;

const DECISION_STATUSES = ["under_review", "intend_to_exercise", "do_not_exercise"] as const satisfies readonly BreakClauseStatus[];

type DecisionStatus = (typeof DECISION_STATUSES)[number];

const DECISION_LABEL: Record<DecisionStatus, string> = {
  under_review: "Under review",
  intend_to_exercise: "Intend to exercise",
  do_not_exercise: "Do not exercise",
};

const statusPillClass =
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide";

function statusPillTone(status: BreakClauseStatus): string {
  switch (status) {
    case "under_review":
      return "border-amber-200 bg-amber-50 text-amber-900";
    case "intend_to_exercise":
      return "border-emerald-200 bg-emerald-50 text-emerald-900";
    case "do_not_exercise":
      return "border-slate-200 bg-slate-100 text-slate-700";
    case "expired":
      return "border-slate-200 bg-slate-50 text-slate-500";
    default:
      return "border-slate-200 bg-white text-slate-700";
  }
}

export function LeaseBreakClausePanel({ leaseId, extracted }: LeaseBreakClausePanelProps) {
  const router = useRouter();
  const dates = breakDatesFromExtracted(extracted.break_dates);
  const noticeDays = extracted.notice_period_days;
  const [statusMap, setStatusMap] = useState(() => parseBreakClauseStatusMap(extracted.break_clause_status));
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setStatusMap(parseBreakClauseStatusMap(extracted.break_clause_status));
  }, [extracted.break_clause_status]);

  const snippets = jsonSnippetMap(extracted.source_snippets);
  const sharedSnippet = snippetEvidenceForField("break_dates", snippets);

  const persist = useCallback(
    async (breakIso: string, next: BreakClauseStatus) => {
      setSaving(breakIso);
      setError(null);
      try {
        const res = await fetch(`/api/leases/${leaseId}/break-clause-status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ statuses: { [breakIso]: next } }),
        });
        const payload = (await res.json()) as { error?: string; break_clause_status?: Json };
        if (!res.ok) {
          throw new Error(payload.error ?? "Update failed.");
        }
        if (payload.break_clause_status != null) {
          setStatusMap(parseBreakClauseStatusMap(payload.break_clause_status));
        } else {
          setStatusMap((prev) => ({ ...prev, [breakIso]: next }));
        }
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Update failed.");
      } finally {
        setSaving(null);
      }
    },
    [leaseId, router],
  );

  if (dates.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-white/60 px-4 py-3 text-sm text-slate-600">
        No break dates extracted for this lease.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
      {dates.map((iso) => {
        const breakLabel = formatIsoDate(iso) ?? iso;
        const deadlineIso = breakNoticeDeadlineIso(iso, noticeDays);
        const deadlineLabel = deadlineIso != null ? (formatIsoDate(deadlineIso) ?? deadlineIso) : "—";
        const status = statusMap[iso] ?? "available";
        const busy = saving === iso;

        return (
          <div
            key={iso}
            className="rounded-lg border border-slate-200/90 bg-white px-4 py-3 shadow-sm ring-1 ring-slate-900/5"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Break option</p>

            <dl className="mt-2 grid gap-2 sm:grid-cols-3 sm:gap-4">
              <div>
                <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Break date</dt>
                <dd className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">{breakLabel}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Notice deadline</dt>
                <dd className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">{deadlineLabel}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Current status</dt>
                <dd className="mt-1">
                  <span className={`${statusPillClass} ${statusPillTone(status)}`}>{BREAK_CLAUSE_STATUS_LABEL[status]}</span>
                </dd>
              </div>
            </dl>

            <div className="mt-3 flex flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                {DECISION_STATUSES.map((decision) => {
                  const selected = status === decision;
                  return (
                    <button
                      key={decision}
                      type="button"
                      disabled={busy}
                      onClick={() => void persist(iso, decision)}
                      className={[
                        "rounded-lg border px-3 py-1.5 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                        selected
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-300 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50",
                      ].join(" ")}
                    >
                      {DECISION_LABEL[decision]}
                    </button>
                  );
                })}
              </div>
              {status !== "available" ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void persist(iso, "available")}
                  className="self-start text-xs font-medium text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Reset to available
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
      {sharedSnippet ? (
        <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Shared lease excerpt</p>
          <blockquote className="mt-2 border-l-2 border-slate-300 bg-white/80 py-2 pl-3 pr-2 font-serif text-sm italic leading-relaxed text-slate-800">
            {sharedSnippet}
          </blockquote>
        </div>
      ) : null}
    </div>
  );
}
