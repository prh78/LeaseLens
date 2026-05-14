import Link from "next/link";

import { LeaseChangeHistory } from "@/components/leases/lease-change-history";
import { LeaseDetailEmptyHint, LeaseDetailSection } from "@/components/leases/lease-detail-section";
import { LeaseDocumentConflicts } from "@/components/leases/lease-document-conflicts";
import { LeaseDocumentTimeline } from "@/components/leases/lease-document-timeline";
import { LeaseOperativeTerms } from "@/components/leases/lease-operative-terms";
import { RiskBadge } from "@/components/leases/risk-badge";
import { LEASE_NEXT_ACTION_LABEL, type LeaseNextActionResult } from "@/lib/lease/compute-lease-next-action";
import { formatNextActionDueLabel } from "@/lib/lease/format-next-action-due-label";
import { formatIsoDate, humanizeKey, jsonSnippetMap } from "@/lib/lease/lease-detail";
import {
  parseChangeHistory,
  parseDocumentConflicts,
  parseFieldProvenance,
} from "@/lib/lease/lease-detail-json";
import { PROPERTY_TYPES } from "@/lib/lease/property-types";
import { LEASE_DOCUMENT_TYPE_LABEL } from "@/lib/lease/lease-document-types";
import type { ExtractionStatus, LeaseNextActionUrgency, OverallRisk, Tables } from "@/lib/supabase/database.types";

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
  documents: readonly Tables<"lease_documents">[];
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
    calculating_risks: {
      label: "Calculating risks",
      className: "bg-amber-50 text-amber-950 border-amber-200",
    },
    complete: { label: "Complete", className: "bg-emerald-50 text-emerald-900 border-emerald-200" },
    failed: { label: "Failed", className: "bg-red-50 text-red-900 border-red-200" },
  };
  return map[status];
}

const documentPdfLinkClassName =
  "inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm ring-1 ring-slate-900/5 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400";

function PdfGlyph() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="size-4 shrink-0 text-slate-500" aria-hidden>
      <path
        fillRule="evenodd"
        d="M4.5 2A1.5 1.5 0 0 0 3 3.5v13A1.5 1.5 0 0 0 4.5 18h11a1.5 1.5 0 0 0 1.5-1.5V7.621a1.5 1.5 0 0 0-.44-1.06l-4.12-4.122A1.5 1.5 0 0 0 11.378 2H4.5Zm2.25 8.5a.75.75 0 0 0 0 1.5h6.5a.75.75 0 0 0 0-1.5h-6.5Zm0 3a.75.75 0 0 0 0 1.5h6.5a.75.75 0 0 0 0-1.5h-6.5Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function LeaseDetailView({ lease, extracted, nextAction, documents }: LeaseDetailViewProps) {
  const risk = overallRiskDisplay(lease.overall_risk);
  const statusPill = extractionStatusPill(lease.extraction_status);
  const uploadLabel = new Date(lease.upload_date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const snippets = extracted ? jsonSnippetMap(extracted.source_snippets) : {};
  const hasSupplementalDocuments = documents.some((d) => d.document_type !== "primary_lease");
  const provenance = extracted ? parseFieldProvenance(extracted.field_provenance) : {};
  const changeHistory = extracted ? parseChangeHistory(extracted.change_history) : [];
  const documentConflicts = extracted ? parseDocumentConflicts(extracted.document_conflicts) : [];

  const primaryDocument = documents.find((d) => d.document_type === "primary_lease");
  const canViewPrimary = Boolean(lease.file_url?.trim() || primaryDocument?.file_url?.trim());
  const supplementalDocumentsWithFile = documents
    .filter((d) => d.document_type !== "primary_lease" && d.file_url?.trim())
    .slice()
    .sort((a, b) => new Date(a.upload_date).getTime() - new Date(b.upload_date).getTime());

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
        {canViewPrimary || supplementalDocumentsWithFile.length > 0 ? (
          <div className="flex shrink-0 flex-col items-stretch gap-2 sm:max-w-md sm:items-end sm:pt-1">
            {canViewPrimary ? (
              <a
                href={`/api/leases/${lease.id}/document`}
                target="_blank"
                rel="noopener noreferrer"
                className={documentPdfLinkClassName}
              >
                <PdfGlyph />
                View primary lease
              </a>
            ) : null}
            {supplementalDocumentsWithFile.map((doc) => (
              <a
                key={doc.id}
                href={`/api/leases/${lease.id}/documents/${doc.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className={documentPdfLinkClassName}
              >
                <PdfGlyph />
                View {LEASE_DOCUMENT_TYPE_LABEL[doc.document_type]}
              </a>
            ))}
          </div>
        ) : null}
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
          ) : lease.extraction_status === "calculating_risks" ? (
            <p>
              Structured data is saved. Calculating portfolio risks, alerts, and next actions — usually only a
              moment. You can return to the{" "}
              <Link href="/dashboard" className="font-semibold underline underline-offset-2">
                dashboard
              </Link>
              .
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

      <LeaseDetailSection
        title="Next critical action"
        description="Prioritised from break notices, rent reviews, lease expiry, then manual review when applicable."
      >
        {lease.extraction_status === "failed" ? (
          <LeaseDetailEmptyHint>
            Next action is unavailable because processing did not complete. Fix the issue (see above) and re-run
            upload or analysis from the dashboard.
          </LeaseDetailEmptyHint>
        ) : nextAction &&
          (lease.extraction_status === "complete" || lease.extraction_status === "calculating_risks") ? (
          <div className="space-y-3">
            {lease.extraction_status === "calculating_risks" ? (
              <p className="text-xs text-slate-500">
                Finalising alerts and dashboard fields — this page will update when processing completes.
              </p>
            ) : null}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-2">
                <p className="text-lg font-semibold text-slate-900">
                  {LEASE_NEXT_ACTION_LABEL[nextAction.action_type]}
                </p>
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
          </div>
        ) : lease.extraction_status === "complete" ? (
          <LeaseDetailEmptyHint>No upcoming action could be derived from the extracted fields for this lease.</LeaseDetailEmptyHint>
        ) : (
          <LeaseDetailEmptyHint>
            {lease.extraction_status === "calculating_risks" ? (
              <>
                Next action and alerts are being finalised. This lease is{" "}
                <span className="font-medium text-slate-800">
                  {extractionStatusPill(lease.extraction_status).label}
                </span>
                .
              </>
            ) : (
              <>
                Next action is calculated after structured analysis finishes. This lease is still{" "}
                <span className="font-medium text-slate-800">
                  {extractionStatusPill(lease.extraction_status).label}
                </span>
                .
              </>
            )}
          </LeaseDetailEmptyHint>
        )}
      </LeaseDetailSection>

      {hasSupplementalDocuments ? (
        <LeaseDocumentTimeline leaseId={lease.id} documents={documents} />
      ) : (
        <LeaseDetailSection
          title="Supplemental documents"
          description="Amendments, extensions, and other instruments that modify the primary lease."
        >
          <LeaseDetailEmptyHint>No supplemental lease documents uploaded.</LeaseDetailEmptyHint>
        </LeaseDetailSection>
      )}

      {extracted ? (
        <LeaseOperativeTerms extracted={extracted} provenance={provenance} />
      ) : (
        <LeaseDetailSection
          title="Current operative terms"
          description="Resolved portfolio view after applying supplemental overrides."
        >
          <LeaseDetailEmptyHint>No extracted data yet. Complete text extraction first.</LeaseDetailEmptyHint>
        </LeaseDetailSection>
      )}

      {hasSupplementalDocuments ? <LeaseChangeHistory entries={changeHistory} /> : null}

      <LeaseDocumentConflicts conflicts={documentConflicts} />

      <div className="space-y-6">
        {/* Risk flags */}
        <LeaseDetailSection title="Risk flags" description="Automated signals from structured analysis.">
          {!extracted ? (
            <LeaseDetailEmptyHint>No structured fields yet.</LeaseDetailEmptyHint>
          ) : flags.length === 0 ? (
            <LeaseDetailEmptyHint>No automated risk flags for this lease.</LeaseDetailEmptyHint>
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
        </LeaseDetailSection>

        {/* Source snippets */}
        <LeaseDetailSection
          title="Source clause snippets"
          description="Verbatim excerpts keyed by topic. Cross-check the PDF before relying on these."
        >
          {!extracted ? (
            <LeaseDetailEmptyHint>No snippets yet.</LeaseDetailEmptyHint>
          ) : Object.keys(snippets).length === 0 ? (
            <LeaseDetailEmptyHint>No source snippets stored for this lease.</LeaseDetailEmptyHint>
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
        </LeaseDetailSection>
      </div>
    </div>
  );
}
