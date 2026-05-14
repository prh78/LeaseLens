"use client";

import { useCallback, useMemo, useState } from "react";

import { LeaseDetailSection } from "@/components/leases/lease-detail-section";
import { LEASE_DOCUMENT_TYPE_LABEL } from "@/lib/lease/lease-document-types";
import type { LeaseDocumentProcessingStatus, Tables } from "@/lib/supabase/database.types";

const statusBadge: Record<
  LeaseDocumentProcessingStatus,
  { label: string; className: string }
> = {
  pending: { label: "Pending", className: "bg-slate-100 text-slate-800 ring-slate-200" },
  uploading: { label: "Uploading", className: "bg-slate-100 text-slate-800 ring-slate-200" },
  extracting_text: { label: "Extracting", className: "bg-sky-50 text-sky-900 ring-sky-200" },
  analysing: { label: "Analysing", className: "bg-violet-50 text-violet-900 ring-violet-200" },
  complete: { label: "Complete", className: "bg-emerald-50 text-emerald-900 ring-emerald-200" },
  failed: { label: "Failed", className: "bg-red-50 text-red-900 ring-red-200" },
};

type LeaseDocumentTimelineProps = Readonly<{
  leaseId: string;
  documents: readonly Tables<"lease_documents">[];
}>;

export function LeaseDocumentTimeline({ leaseId, documents }: LeaseDocumentTimelineProps) {
  const [openId, setOpenId] = useState<string | null>(null);

  const ordered = useMemo(() => {
    return [...documents].sort((a, b) => new Date(a.upload_date).getTime() - new Date(b.upload_date).getTime());
  }, [documents]);

  const toggle = useCallback((id: string) => {
    setOpenId((prev) => (prev === id ? null : id));
  }, []);

  return (
    <LeaseDetailSection
      title="Document timeline"
      description="Chronological record of all documents on file for this lease. Expand a row for quick actions."
    >
      <div className="relative pl-4">
        <div className="absolute bottom-2 left-[11px] top-2 w-px bg-slate-200" aria-hidden />
        <ul className="space-y-4">
          {ordered.map((doc) => {
            const open = openId === doc.id;
            const name =
              doc.display_name?.trim() ||
              `${LEASE_DOCUMENT_TYPE_LABEL[doc.document_type]} · ${new Date(doc.upload_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
            const st = statusBadge[doc.processing_status];
            const pdfHref = doc.file_url ? `/api/leases/${leaseId}/documents/${doc.id}` : undefined;

            return (
              <li key={doc.id} className="relative">
                <span className="absolute -left-px top-4 z-[1] size-2.5 rounded-full border-2 border-white bg-slate-400 shadow-sm ring-1 ring-slate-300" />
                <div className="rounded-xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/40 shadow-sm">
                  <button
                    type="button"
                    onClick={() => toggle(doc.id)}
                    className="flex w-full items-start justify-between gap-3 rounded-xl px-4 py-3 text-left transition hover:bg-slate-50/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-slate-400"
                  >
                    <div className="min-w-0 space-y-1">
                      <p className="truncate text-sm font-semibold text-slate-900">{name}</p>
                      <p className="text-xs text-slate-500">{LEASE_DOCUMENT_TYPE_LABEL[doc.document_type]}</p>
                      <p className="text-xs tabular-nums text-slate-500">
                        Uploaded{" "}
                        {new Date(doc.upload_date).toLocaleString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${st.className}`}
                    >
                      {st.label}
                    </span>
                  </button>
                  {open ? (
                    <div className="border-t border-slate-100 px-4 py-3 text-sm">
                      <div className="flex flex-wrap gap-3">
                        {pdfHref ? (
                          <a
                            href={pdfHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
                          >
                            Open PDF
                          </a>
                        ) : (
                          <span className="text-xs text-slate-500">PDF not attached yet.</span>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </LeaseDetailSection>
  );
}
