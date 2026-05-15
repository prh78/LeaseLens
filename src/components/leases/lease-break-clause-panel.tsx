"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  ExtractionConfidencePill,
  OperativeEvidenceCollapsibles,
  fieldConfidenceBand,
  operativeTermCardClass,
} from "@/components/leases/operative-evidence-parts";
import { snippetEvidenceForField } from "@/lib/lease/lease-detail-audit";
import {
  BREAK_CLAUSE_STATUS_LABEL,
  breakDatesFromExtracted,
  parseBreakClauseStatusMap,
  type BreakClauseStatus,
} from "@/lib/lease/break-clause-status";
import { breakNoticeDeadlineIso, breakWindowOpensIso } from "@/lib/lease/compute-lease-next-action";
import {
  parseDateFieldConfidence,
  parseFieldExtractionMeta,
  type DateFieldConfidenceMap,
  type FieldExtractionMetaEntry,
} from "@/lib/lease/field-extraction-meta";
import { formatIsoDate, jsonSnippetMap } from "@/lib/lease/lease-detail";
import type { Json, Tables } from "@/lib/supabase/database.types";

type LeaseBreakClausePanelProps = Readonly<{
  leaseId: string;
  extracted: Tables<"extracted_data">;
}>;

const BREAK_FIELD = "break_dates";

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

type BreakOptionRowProps = Readonly<{
  breakLabel: string;
  availableFromLabel: string;
  noticeDeadlineLabel: string;
  noticePeriodDays: number | null;
  status: BreakClauseStatus;
  busy: boolean;
  onPersist: (status: BreakClauseStatus) => void;
  snippetText: string | undefined;
  allMeta: Record<string, FieldExtractionMetaEntry>;
  globalConfidence: number | null | undefined;
  dateFieldConfidence: DateFieldConfidenceMap;
}>;

function BreakOptionRow({
  breakLabel,
  availableFromLabel,
  noticeDeadlineLabel,
  noticePeriodDays,
  status,
  busy,
  onPersist,
  snippetText,
  allMeta,
  globalConfidence,
  dateFieldConfidence,
}: BreakOptionRowProps) {
  const band = fieldConfidenceBand(BREAK_FIELD, allMeta, globalConfidence, dateFieldConfidence);
  const isCommitted = status === "intend_to_exercise";
  const showAvailableFrom = status === "available" || status === "under_review";

  return (
    <div className={operativeTermCardClass}>
      <div className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Break option</p>
          <p className="mt-0.5 text-lg font-semibold leading-snug tabular-nums text-slate-900">{breakLabel}</p>
          {showAvailableFrom ? (
            <p className="mt-1 text-[11px] leading-snug text-slate-500">
              Available from{" "}
              <span className="font-medium tabular-nums text-slate-700">{availableFromLabel}</span>
            </p>
          ) : null}
          {isCommitted ? (
            <div className="mt-1 space-y-1 text-[11px] leading-snug text-slate-500">
              <p>
                Notice deadline:{" "}
                <span className="font-medium tabular-nums text-slate-700">{noticeDeadlineLabel}</span>
              </p>
              <p>
                {noticePeriodDays != null && noticePeriodDays >= 1
                  ? `If notice is exercised, the tenancy ends after the ${noticePeriodDays}-day notice period from the date notice is served.`
                  : "If notice is exercised, the tenancy ends after the notice period from the date notice is served."}
              </p>
            </div>
          ) : null}
          <p className="mt-1.5">
            <span className={`${statusPillClass} ${statusPillTone(status)}`}>{BREAK_CLAUSE_STATUS_LABEL[status]}</span>
          </p>
        </div>
        <ExtractionConfidencePill band={band} />
      </div>

      <div className="border-t border-slate-100 px-3 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Decision</p>
        <div className="mt-2 flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            {DECISION_STATUSES.map((decision) => {
              const selected = status === decision;
              return (
                <button
                  key={decision}
                  type="button"
                  disabled={busy}
                  onClick={() => onPersist(decision)}
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
              onClick={() => onPersist("available")}
              className="self-start text-xs font-medium text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
            >
              Reset to available
            </button>
          ) : null}
        </div>
      </div>

      <OperativeEvidenceCollapsibles
        field={BREAK_FIELD}
        snippetText={snippetText}
        allMeta={allMeta}
        globalConfidence={globalConfidence}
        dateFieldConfidence={dateFieldConfidence}
      />
    </div>
  );
}

export function LeaseBreakClausePanel({ leaseId, extracted }: LeaseBreakClausePanelProps) {
  const router = useRouter();
  const dates = breakDatesFromExtracted(extracted.break_dates);
  const noticeDays = extracted.notice_period_days;
  const [statusMap, setStatusMap] = useState(() => parseBreakClauseStatusMap(extracted.break_clause_status));
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const snippets = jsonSnippetMap(extracted.source_snippets);
  const breakSnippet = snippetEvidenceForField(BREAK_FIELD, snippets);
  const fieldMeta = parseFieldExtractionMeta(extracted.field_extraction_meta);
  const dateFieldConfidence = parseDateFieldConfidence(extracted.date_field_confidence);

  useEffect(() => {
    setStatusMap(parseBreakClauseStatusMap(extracted.break_clause_status));
  }, [extracted.break_clause_status]);

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
      <div className="rounded-lg border border-dashed border-slate-200 bg-white/60 px-3 py-2.5 text-sm text-slate-600">
        No break dates extracted for this lease.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
      {dates.map((iso) => {
        const breakLabel = formatIsoDate(iso) ?? iso;
        const availableFromIso = breakWindowOpensIso(iso, noticeDays);
        const availableFromLabel =
          availableFromIso != null ? (formatIsoDate(availableFromIso) ?? availableFromIso) : "—";
        const noticeDeadlineIso = breakNoticeDeadlineIso(iso, noticeDays);
        const noticeDeadlineLabel =
          noticeDeadlineIso != null ? (formatIsoDate(noticeDeadlineIso) ?? noticeDeadlineIso) : "—";
        const status = statusMap[iso] ?? "available";

        return (
          <BreakOptionRow
            key={iso}
            breakLabel={breakLabel}
            availableFromLabel={availableFromLabel}
            noticeDeadlineLabel={noticeDeadlineLabel}
            noticePeriodDays={noticeDays}
            status={status}
            busy={saving === iso}
            onPersist={(next) => void persist(iso, next)}
            snippetText={breakSnippet}
            allMeta={fieldMeta}
            globalConfidence={extracted.confidence_score}
            dateFieldConfidence={dateFieldConfidence}
          />
        );
      })}
    </div>
  );
}
