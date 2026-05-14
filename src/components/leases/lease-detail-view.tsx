import type { ReactNode } from "react";
import Link from "next/link";

import { PROPERTY_TYPES } from "@/lib/lease/property-types";
import {
  formatIsoDate,
  humanizeKey,
  jsonSnippetMap,
  jsonStringArray,
} from "@/lib/lease/lease-detail";
import { LEASE_NEXT_ACTION_LABEL, type LeaseNextActionResult } from "@/lib/lease/compute-lease-next-action";
import { formatNextActionDueLabel } from "@/lib/lease/format-next-action-due-label";
import type { ExtractionStatus, LeaseNextActionUrgency, OverallRisk, Tables } from "@/lib/supabase/database.types";

import { RiskBadge } from "@/components/leases/risk-badge";

const nextActionUrgencyStyles: Record<
  LeaseNextActionUrgency,
  { label: string; className: string }
> = {
  low: { label: "Low", className: "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200" },
  medium: { label: "Medium", className: "bg-sky-50 text-sky-900 ring-1 ring-inset ring-sky-200/80" },
  high: { label: "High", className: "bg-amber-50 text-amber-950 ring-1 ring-inset ring-amber-200/80" },
  critical: { label: "Critical", className: "bg-red-50 text-red-950 ring-1 ring-inset ring-red-200/80" },
};

type LeaseDetailViewProps = Readonly<{
  lease: Tables<"leases">;
  extracted: Tables<"extracted_data"> | null;
  nextAction: LeaseNextActionResult | null;
}>;

function propertyTypeLabel(value: string): string {
  const hit = PROPERTY_TYPES.find((p) => p.value === value);
  return hit?.label ?? value;
}

function overallRiskDisplay(risk: OverallRisk): { level: "low" | "medium" | "high"; critical: boolean } {
  if (risk === "low") {
    return { level: "low", critical: false };
  }
  if (risk === "medium") {
    return { level: "medium", critical: false };
  }
  if (risk === "high") {
    return { level: "high", critical: false };
  }
  return { level: "high", critical: true };
}

function extractionStatusPill(status: ExtractionStatus): { label: string; className: string } {
  const map: Record<ExtractionStatus, { label: string; className: string }> = {
    uploading: { label: "Uploading", className: "bg-slate-100 text-slate-800 border-slate-200" },
    extracting: { label: "Extracting", className: "bg-sky-50 text-sky-900 border-sky-200" },
    analysing: { label: "Analysing", className: "bg-violet-50 text-violet-900 border-violet-200" },
    complete: { label: "Complete", className: "bg-emerald-50 text-emerald-900 border-emerald-200" },
    failed: { label: "Failed", className: "bg-red-50 text-red-900 border-red-200" },
  };
  return map[status];
}

function SectionShell(props: Readonly<{ title: string; description?: string; children: ReactNode }>) {
  const { title, description, children } = props;
  return (
    <section className="rounded-xl border border-slate-200/90 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">{title}</h2>
        {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

function EmptyHint(props: Readonly<{ children: ReactNode }>) {
  return (
    <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-center text-sm text-slate-600">
      {props.children}
    </p>
  );
}

type DateRowProps = Readonly<{ label: string; value: string | null }>;

function DateRow({ label, value }: DateRowProps) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-slate-100 py-3 last:border-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <span className="text-sm tabular-nums text-slate-900 sm:text-right">{value ?? "—"}</span>
    </div>
  );
}

export function LeaseDetailView({ lease, extracted, nextAction }: LeaseDetailViewProps) {
  const risk = overallRiskDisplay(lease.overall_risk);
  const statusPill = extractionStatusPill(lease.extraction_status);
  const uploadLabel = new Date(lease.upload_date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const breakDates = extracted ? jsonStringArray(extracted.break_dates) : [];
  const rentReviews = extracted ? jsonStringArray(extracted.rent_review_dates) : [];
  const snippets = extracted ? jsonSnippetMap(extracted.source_snippets) : {};

  const confidencePct =
    extracted?.confidence_score != null
      ? `${Math.round(Math.min(1, Math.max(0, extracted.confidence_score)) * 100)}%`
      : null;

  const flags: { id: string; title: string; detail?: string | null; badge: "low" | "medium" | "high"; critical?: boolean }[] =
    [];

  if (extracted?.manual_review_recommended === true) {
    flags.push({
      id: "manual",
      title: "Manual review recommended",
      detail: "Model flagged this lease for human verification.",
      badge: "high",
    });
  }
  if (extracted?.ambiguous_language === true) {
    flags.push({
      id: "ambiguous",
      title: "Ambiguous language",
      detail: "Some clauses may be open to interpretation.",
      badge: "medium",
    });
  }
  if (extracted?.conditional_break_clause && extracted.conditional_break_clause.trim()) {
    flags.push({
      id: "conditional_break",
      title: "Conditional break clause",
      detail: extracted.conditional_break_clause,
      badge: "medium",
    });
  }
  if (extracted?.reinstatement_required === true) {
    flags.push({
      id: "reinstatement",
      title: "Reinstatement required",
      badge: "low",
    });
  }
  if (extracted?.vacant_possession_required === true) {
    flags.push({
      id: "vacant",
      title: "Vacant possession required",
      badge: "low",
    });
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 border-b border-slate-200/80 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/dashboard"
            className="text-sm font-medium text-slate-600 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
          >
            ← Dashboard
          </Link>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{lease.property_name}</h1>
          <p className="mt-2 text-sm text-slate-600">
            {propertyTypeLabel(lease.property_type)} · Uploaded {uploadLabel}
          </p>
        </div>
      </div>

      {lease.extraction_status !== "complete" ? (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            lease.extraction_status === "failed"
              ? "border-red-200 bg-red-50/90 text-red-950"
              : "border-amber-200 bg-amber-50/80 text-amber-950"
          }`}
        >
          {lease.extraction_status === "failed" ? (
            <>
              <p className="font-medium">Lease processing failed.</p>
              {lease.extraction_error ? (
                <p className="mt-2 text-red-900/90">{lease.extraction_error}</p>
              ) : null}
              <p className="mt-2">
                <Link href="/upload" className="font-semibold underline underline-offset-2">
                  Upload again
                </Link>{" "}
                or open the{" "}
                <Link href="/dashboard" className="font-semibold underline underline-offset-2">
                  dashboard
                </Link>
                .
              </p>
            </>
          ) : lease.extraction_status === "uploading" ? (
            <p>Lease record is being created and the PDF is attaching to storage.</p>
          ) : lease.extraction_status === "extracting" ? (
            <p>
              Reading your PDF and extracting text. You can stay on this page or return to the{" "}
              <Link href="/dashboard" className="font-semibold underline underline-offset-2">
                dashboard
              </Link>{" "}
              — processing continues in the background.
            </p>
          ) : (
            <p>
              Running structured AI analysis on the lease text. You can return to the{" "}
              <Link href="/dashboard" className="font-semibold underline underline-offset-2">
                dashboard
              </Link>{" "}
              while this finishes.
            </p>
          )}
        </div>
      ) : null}

      {/* Summary */}
      <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/90 p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Summary</p>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold ${statusPill.className}`}
              >
                {statusPill.label}
              </span>
              {confidencePct ? (
                <span className="text-xs text-slate-600">
                  Model confidence <span className="font-semibold text-slate-900">{confidencePct}</span>
                </span>
              ) : null}
            </div>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">Property</dt>
                <dd className="mt-0.5 font-medium text-slate-900">{lease.property_name}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Type</dt>
                <dd className="mt-0.5 font-medium text-slate-900">{propertyTypeLabel(lease.property_type)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Term start</dt>
                <dd className="mt-0.5 font-medium text-slate-900">
                  {formatIsoDate(extracted?.commencement_date ?? null) ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Term end</dt>
                <dd className="mt-0.5 font-medium text-slate-900">
                  {formatIsoDate(extracted?.expiry_date ?? null) ?? "—"}
                </dd>
              </div>
            </dl>
          </div>
          <div className="shrink-0 rounded-xl border border-slate-200/80 bg-white/80 px-5 py-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Overall risk</p>
            <div className="mt-3">
              <RiskBadge level={risk.level} critical={risk.critical} />
            </div>
            <p className="mt-3 max-w-[14rem] text-xs leading-relaxed text-slate-600">
              Portfolio-level assessment for this lease. Refine with your own legal review.
            </p>
          </div>
        </div>
      </section>

      <SectionShell
        title="Next critical action"
        description="Prioritised from break notices, rent reviews, lease expiry, then manual review when applicable."
      >
        {lease.extraction_status === "failed" ? (
          <EmptyHint>
            Next action is unavailable because processing did not complete. Fix the issue (see above) and re-run
            upload or analysis from the dashboard.
          </EmptyHint>
        ) : lease.extraction_status !== "complete" ? (
          <EmptyHint>
            Next action is calculated after structured analysis finishes. This lease is still{" "}
            <span className="font-medium text-slate-800">{extractionStatusPill(lease.extraction_status).label}</span>.
          </EmptyHint>
        ) : !nextAction ? (
          <EmptyHint>No upcoming action could be derived from the extracted fields for this lease.</EmptyHint>
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-2">
              <p className="text-lg font-semibold text-slate-900">{LEASE_NEXT_ACTION_LABEL[nextAction.action_type]}</p>
              <p className="text-sm text-slate-600">{formatNextActionDueLabel(nextAction)}</p>
              {nextAction.action_date ? (
                <p className="text-xs font-mono tabular-nums text-slate-500">Date: {nextAction.action_date}</p>
              ) : null}
            </div>
            <div className="shrink-0">
              <span
                className={`inline-flex rounded-md px-2.5 py-1 text-xs font-semibold ${nextActionUrgencyStyles[nextAction.urgency_level].className}`}
              >
                Urgency: {nextActionUrgencyStyles[nextAction.urgency_level].label}
              </span>
            </div>
          </div>
        )}
      </SectionShell>

      <div className="space-y-6">
        {/* Critical dates */}
        <SectionShell
          title="Critical dates"
          description="Key dates extracted from the lease. Always verify against the signed document."
        >
          {!extracted ? (
            <EmptyHint>No extracted data yet. Complete text extraction first.</EmptyHint>
          ) : (
            <div>
              <DateRow label="Commencement" value={formatIsoDate(extracted.commencement_date)} />
              <DateRow label="Expiry" value={formatIsoDate(extracted.expiry_date)} />
              <DateRow
                label="Notice period"
                value={
                  extracted.notice_period_days != null
                    ? `${extracted.notice_period_days} day${extracted.notice_period_days === 1 ? "" : "s"}`
                    : null
                }
              />
              {breakDates.length ? (
                <div className="py-3">
                  <p className="text-sm font-medium text-slate-700">Break options</p>
                  <ul className="mt-2 space-y-1.5">
                    {breakDates.map((d) => (
                      <li key={d} className="text-sm tabular-nums text-slate-900">
                        {formatIsoDate(d)}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <DateRow label="Break options" value={null} />
              )}
              {rentReviews.length ? (
                <div className="border-t border-slate-100 py-3">
                  <p className="text-sm font-medium text-slate-700">Rent reviews</p>
                  <ul className="mt-2 space-y-1.5">
                    {rentReviews.map((d) => (
                      <li key={d} className="text-sm tabular-nums text-slate-900">
                        {formatIsoDate(d)}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </SectionShell>

        {/* Obligations */}
        <SectionShell
          title="Obligations"
          description="Repairing, service charge, and handback obligations captured from the document."
        >
          {!extracted ? (
            <EmptyHint>No extracted data yet.</EmptyHint>
          ) : (
            <div className="space-y-5">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Repairing obligation</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                  {extracted.repairing_obligation?.trim() || "—"}
                </p>
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Service charge</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                  {extracted.service_charge_responsibility?.trim() || "—"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700">
                  Reinstatement:{" "}
                  {extracted.reinstatement_required == null
                    ? "—"
                    : extracted.reinstatement_required
                      ? "Yes"
                      : "No"}
                </span>
                <span className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700">
                  Vacant possession:{" "}
                  {extracted.vacant_possession_required == null
                    ? "—"
                    : extracted.vacant_possession_required
                      ? "Yes"
                      : "No"}
                </span>
              </div>
            </div>
          )}
        </SectionShell>

        {/* Risk flags */}
        <SectionShell title="Risk flags" description="Automated signals from structured analysis.">
          {!extracted ? (
            <EmptyHint>No structured fields yet.</EmptyHint>
          ) : flags.length === 0 ? (
            <EmptyHint>No automated risk flags for this lease.</EmptyHint>
          ) : (
            <ul className="space-y-3">
              {flags.map((f) => (
                <li
                  key={f.id}
                  className="flex flex-col gap-2 rounded-lg border border-slate-100 bg-slate-50/50 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{f.title}</p>
                    {f.detail ? <p className="mt-1 text-sm leading-relaxed text-slate-600">{f.detail}</p> : null}
                  </div>
                  <div className="shrink-0 sm:pt-0.5">
                    <RiskBadge level={f.badge} critical={f.critical} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionShell>

        {/* Source snippets */}
        <SectionShell
          title="Source clause snippets"
          description="Verbatim excerpts keyed by topic. Cross-check the PDF before relying on these."
        >
          {!extracted ? (
            <EmptyHint>No snippets yet.</EmptyHint>
          ) : Object.keys(snippets).length === 0 ? (
            <EmptyHint>No source snippets stored for this lease.</EmptyHint>
          ) : (
            <div className="space-y-4">
              {Object.entries(snippets).map(([key, text]) => (
                <article
                  key={key}
                  className="rounded-lg border border-slate-200 bg-slate-50/40 px-4 py-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.6)]"
                >
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">{humanizeKey(key)}</h3>
                  <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-slate-800">
                    {text}
                  </pre>
                </article>
              ))}
            </div>
          )}
        </SectionShell>
      </div>
    </div>
  );
}
