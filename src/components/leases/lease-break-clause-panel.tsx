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
  BREAK_CLAUSE_EVIDENCE_LABEL,
  BREAK_CLAUSE_EVIDENCE_TYPES,
  BREAK_CLAUSE_STATUS_LABEL,
  type BreakClauseEntry,
  type BreakClauseEntryPatch,
  type BreakClauseEvidenceType,
  type BreakClauseStatus,
  breakDatesFromExtracted,
  parseBreakClauseEntryMap,
  tenancyEndFromServedNotice,
} from "@/lib/lease/break-clause-status";
import { breakWindowOpensIso } from "@/lib/lease/compute-lease-next-action";
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

const DECISION_STATUSES = [
  "under_review",
  "intend_to_exercise",
  "served",
  "do_not_exercise",
] as const satisfies readonly BreakClauseStatus[];

type DecisionStatus = (typeof DECISION_STATUSES)[number];

const DECISION_LABEL: Record<DecisionStatus, string> = {
  under_review: "Under review",
  intend_to_exercise: "Intend to exercise",
  served: "Served",
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
    case "served":
      return "border-sky-200 bg-sky-50 text-sky-900";
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
  tenancyEndLabel: string | null;
  noticePeriodDays: number | null;
  entry: BreakClauseEntry;
  busy: boolean;
  onPersist: (patch: BreakClauseEntryPatch) => void;
  snippetText: string | undefined;
  allMeta: Record<string, FieldExtractionMetaEntry>;
  globalConfidence: number | null | undefined;
  dateFieldConfidence: DateFieldConfidenceMap;
}>;

function BreakOptionRow({
  breakLabel,
  availableFromLabel,
  tenancyEndLabel,
  noticePeriodDays,
  entry,
  busy,
  onPersist,
  snippetText,
  allMeta,
  globalConfidence,
  dateFieldConfidence,
}: BreakOptionRowProps) {
  const { status } = entry;
  const band = fieldConfidenceBand(BREAK_FIELD, allMeta, globalConfidence, dateFieldConfidence);
  const showAvailableFrom =
    status === "available" || status === "under_review" || status === "intend_to_exercise";

  const [draftServed, setDraftServed] = useState(false);
  const [noticeServedDate, setNoticeServedDate] = useState(entry.served?.notice_served_date ?? "");
  const [evidenceType, setEvidenceType] = useState<BreakClauseEvidenceType | "">(
    entry.served?.evidence_type ?? "",
  );
  const [evidenceNote, setEvidenceNote] = useState(entry.served?.evidence_note ?? "");

  const showServedForm = status === "served" || draftServed;

  useEffect(() => {
    if (status === "served") {
      setDraftServed(false);
    }
    setNoticeServedDate(entry.served?.notice_served_date ?? "");
    setEvidenceType(entry.served?.evidence_type ?? "");
    setEvidenceNote(entry.served?.evidence_note ?? "");
  }, [status, entry.served?.notice_served_date, entry.served?.evidence_type, entry.served?.evidence_note]);

  const saveServed = () => {
    if (!noticeServedDate) {
      return;
    }
    onPersist({
      status: "served",
      notice_served_date: noticeServedDate,
      evidence_type: evidenceType || null,
      evidence_note: evidenceNote.trim() || null,
    });
    setDraftServed(false);
  };

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
          {status === "intend_to_exercise" ? (
            <p className="mt-1 text-[11px] leading-snug text-slate-500">
              {noticePeriodDays != null && noticePeriodDays >= 1
                ? `If notice is exercised, the tenancy ends after the ${noticePeriodDays}-day notice period from the date notice is served.`
                : "If notice is exercised, the tenancy ends after the notice period from the date notice is served."}
            </p>
          ) : null}
          {status === "served" && tenancyEndLabel ? (
            <p className="mt-1 text-[11px] leading-snug text-slate-500">
              Tenancy ends{" "}
              <span className="font-medium tabular-nums text-slate-700">{tenancyEndLabel}</span>
              {entry.served
                ? ` (notice served ${formatIsoDate(entry.served.notice_served_date) ?? entry.served.notice_served_date})`
                : null}
            </p>
          ) : null}
          <p className="mt-1.5">
            <span className={`${statusPillClass} ${statusPillTone(status)}`}>{BREAK_CLAUSE_STATUS_LABEL[status]}</span>
          </p>
        </div>
        <ExtractionConfidencePill band={band} />
      </div>

      <div className="border-t border-slate-100 px-3 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Decision</p>
        <div className="mt-2 flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {DECISION_STATUSES.map((decision) => {
              const selected = status === decision;
              return (
                <button
                  key={decision}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (decision === "served") {
                      setDraftServed(true);
                    } else {
                      setDraftServed(false);
                      onPersist({ status: decision });
                    }
                  }}
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

          {showServedForm ? (
            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
              <div>
                <label htmlFor={`notice-served-${breakLabel}`} className="text-[11px] font-semibold text-slate-700">
                  Date notice was served
                </label>
                <input
                  id={`notice-served-${breakLabel}`}
                  type="date"
                  value={noticeServedDate}
                  disabled={busy}
                  onChange={(e) => setNoticeServedDate(e.target.value)}
                  className="mt-1 block w-full max-w-xs rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 disabled:opacity-50"
                />
              </div>
              <fieldset>
                <legend className="text-[11px] font-semibold text-slate-700">
                  Optional supporting evidence
                </legend>
                <div className="mt-2 space-y-2">
                  <label className="flex items-start gap-2 text-xs text-slate-700">
                    <input
                      type="radio"
                      name={`evidence-${breakLabel}`}
                      checked={evidenceType === ""}
                      disabled={busy}
                      onChange={() => setEvidenceType("")}
                      className="mt-0.5"
                    />
                    None recorded
                  </label>
                  {BREAK_CLAUSE_EVIDENCE_TYPES.map((t) => (
                    <label key={t} className="flex items-start gap-2 text-xs text-slate-700">
                      <input
                        type="radio"
                        name={`evidence-${breakLabel}`}
                        checked={evidenceType === t}
                        disabled={busy}
                        onChange={() => setEvidenceType(t)}
                        className="mt-0.5"
                      />
                      {BREAK_CLAUSE_EVIDENCE_LABEL[t]}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div>
                <label htmlFor={`evidence-note-${breakLabel}`} className="text-[11px] font-semibold text-slate-700">
                  Note (optional)
                </label>
                <textarea
                  id={`evidence-note-${breakLabel}`}
                  rows={2}
                  value={evidenceNote}
                  disabled={busy}
                  onChange={(e) => setEvidenceNote(e.target.value)}
                  placeholder="Reference, file name, or brief note"
                  className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 disabled:opacity-50"
                />
              </div>
              <button
                type="button"
                disabled={busy || !noticeServedDate}
                onClick={saveServed}
                className="rounded-lg border border-slate-900 bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Save served details
              </button>
            </div>
          ) : null}

          {status !== "available" ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setDraftServed(false);
                onPersist({ status: "available" });
              }}
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
  const [entryMap, setEntryMap] = useState(() => parseBreakClauseEntryMap(extracted.break_clause_status));
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const snippets = jsonSnippetMap(extracted.source_snippets);
  const breakSnippet = snippetEvidenceForField(BREAK_FIELD, snippets);
  const fieldMeta = parseFieldExtractionMeta(extracted.field_extraction_meta);
  const dateFieldConfidence = parseDateFieldConfidence(extracted.date_field_confidence);

  useEffect(() => {
    setEntryMap(parseBreakClauseEntryMap(extracted.break_clause_status));
  }, [extracted.break_clause_status]);

  const persist = useCallback(
    async (breakIso: string, patch: BreakClauseEntryPatch) => {
      setSaving(breakIso);
      setError(null);
      try {
        const body: Record<string, unknown> = {
          status: patch.status,
        };
        if (patch.status === "served") {
          if (patch.notice_served_date) {
            body.notice_served_date = patch.notice_served_date;
          }
          body.evidence_type = patch.evidence_type ?? null;
          body.evidence_note = patch.evidence_note ?? null;
        }

        const res = await fetch(`/api/leases/${leaseId}/break-clause-status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entries: { [breakIso]: body } }),
        });
        const payload = (await res.json()) as { error?: string; break_clause_status?: Json };
        if (!res.ok) {
          throw new Error(payload.error ?? "Update failed.");
        }
        if (payload.break_clause_status != null) {
          setEntryMap(parseBreakClauseEntryMap(payload.break_clause_status));
        } else {
          setEntryMap((prev) => {
            const next = { ...prev };
            if (patch.status === "served" && patch.notice_served_date) {
              next[breakIso] = {
                status: "served",
                served: {
                  notice_served_date: patch.notice_served_date,
                  evidence_type: patch.evidence_type ?? null,
                  evidence_note: patch.evidence_note ?? null,
                },
              };
            } else {
              next[breakIso] = { status: patch.status, served: null };
            }
            return next;
          });
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
        const entry = entryMap[iso] ?? { status: "available" as const, served: null };
        const tenancyEndIso =
          entry.status === "served" && entry.served
            ? tenancyEndFromServedNotice(entry.served.notice_served_date, noticeDays)
            : null;
        const tenancyEndLabel =
          tenancyEndIso != null ? (formatIsoDate(tenancyEndIso) ?? tenancyEndIso) : null;

        return (
          <BreakOptionRow
            key={iso}
            breakLabel={breakLabel}
            availableFromLabel={availableFromLabel}
            tenancyEndLabel={tenancyEndLabel}
            noticePeriodDays={noticeDays}
            entry={entry}
            busy={saving === iso}
            onPersist={(patch) => void persist(iso, patch)}
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
