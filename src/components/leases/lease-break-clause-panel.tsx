"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { snippetEvidenceForField } from "@/lib/lease/lease-detail-audit";
import {
  BREAK_CLAUSE_STATUSES,
  BREAK_CLAUSE_STATUS_LABEL,
  breakDatesFromExtracted,
  isBreakClauseStatus,
  parseBreakClauseStatusMap,
  type BreakClauseStatus,
} from "@/lib/lease/break-clause-status";
import { formatIsoDate, jsonSnippetMap } from "@/lib/lease/lease-detail";
import type { Json, Tables } from "@/lib/supabase/database.types";

type LeaseBreakClausePanelProps = Readonly<{
  leaseId: string;
  extracted: Tables<"extracted_data">;
}>;

const selectClassName =
  "mt-1 w-full max-w-xs rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none transition focus:border-slate-900 disabled:bg-slate-50";

export function LeaseBreakClausePanel({ leaseId, extracted }: LeaseBreakClausePanelProps) {
  const router = useRouter();
  const dates = breakDatesFromExtracted(extracted.break_dates);
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
        const label = formatIsoDate(iso) ?? iso;
        const status = statusMap[iso] ?? "available";
        return (
          <div
            key={iso}
            className="rounded-lg border border-slate-200/90 bg-white px-4 py-3 shadow-sm ring-1 ring-slate-900/5"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Break option</p>
                <p className="text-sm font-semibold tabular-nums text-slate-900">{label}</p>
                <p className="text-[10px] uppercase tracking-wide text-slate-500">ISO {iso}</p>
              </div>
              <div className="sm:text-right">
                <label htmlFor={`break-status-${iso}`} className="sr-only">
                  Status for break {iso}
                </label>
                <select
                  id={`break-status-${iso}`}
                  className={selectClassName}
                  value={status}
                  disabled={saving === iso}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (isBreakClauseStatus(v)) {
                      void persist(iso, v);
                    }
                  }}
                >
                  {BREAK_CLAUSE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {BREAK_CLAUSE_STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </div>
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
