"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { AuthMessage } from "@/components/auth/auth-message";
import {
  LEASE_DOCUMENT_TYPES,
  LEASE_DOCUMENT_TYPE_LABEL,
  isLeaseDocumentType,
} from "@/lib/lease/lease-document-types";
import { leaseDocumentPdfStoragePath } from "@/lib/lease/lease-storage-path";
import {
  LEASE_AFFECTED_AREA_LABEL,
  LEASE_AFFECTED_AREAS,
  isLeaseAffectedArea,
  supersedesFieldsJsonFromArea,
} from "@/lib/lease/upload-affected-area";
import { validatePdfFile } from "@/lib/lease/validate-pdf";
import { createClient } from "@/lib/supabase/client";
import type { ExtractionStatus, LeaseDocumentType } from "@/lib/supabase/database.types";

const BUCKET = "leases";

const SUPPLEMENTAL_TYPES = LEASE_DOCUMENT_TYPES.filter((t) => t !== "primary_lease");

const defaultSupplementalType: LeaseDocumentType =
  SUPPLEMENTAL_TYPES[0] ?? "deed_of_variation";

type LeaseSupplementalUploadProps = Readonly<{
  leaseId: string;
  extractionStatus: ExtractionStatus;
}>;

export function LeaseSupplementalUpload({ leaseId, extractionStatus }: LeaseSupplementalUploadProps) {
  const router = useRouter();
  const canUpload = extractionStatus === "complete";
  const [documentType, setDocumentType] = useState<LeaseDocumentType>(defaultSupplementalType);
  const [affectedArea, setAffectedArea] = useState<string>("lease_term");
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<"idle" | "creating" | "uploading" | "attaching">("idle");
  const [error, setError] = useState<string | null>(null);

  const busy = phase !== "idle";

  const onFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setFile(event.target.files?.[0] ?? null);
    setError(null);
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!canUpload) {
      return;
    }

    if (!file) {
      setError("Choose a PDF to upload.");
      return;
    }

    const pdfCheck = await validatePdfFile(file);
    if (!pdfCheck.ok) {
      setError(pdfCheck.message);
      return;
    }

    if (!isLeaseDocumentType(documentType) || documentType === "primary_lease") {
      setError("Invalid document type.");
      return;
    }

    if (!isLeaseAffectedArea(affectedArea)) {
      setError("Invalid affected lease area.");
      return;
    }

    const supabase = createClient();
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.user || !session.access_token) {
      setError("You must be signed in to upload.");
      return;
    }

    const user = session.user;
    const supersedesFields = supersedesFieldsJsonFromArea(affectedArea);

    setPhase("creating");
    let docId: string;
    try {
      const res = await fetch(`/api/v1/leases/${encodeURIComponent(leaseId)}/documents`, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ documentType, supersedesFields }),
      });
      const payload = (await res.json()) as { leaseDocumentId?: string; error?: string };
      if (!res.ok) {
        setPhase("idle");
        setError(payload.error ?? "Could not create document.");
        return;
      }
      if (!payload.leaseDocumentId) {
        setPhase("idle");
        setError("Missing document id from server.");
        return;
      }
      docId = payload.leaseDocumentId;
    } catch {
      setPhase("idle");
      setError("Network error while creating document.");
      return;
    }

    const storagePath = leaseDocumentPdfStoragePath(user.id, leaseId, docId);
    setPhase("uploading");

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: "application/pdf",
    });

    if (uploadError) {
      setPhase("idle");
      setError(uploadError.message);
      return;
    }

    setPhase("attaching");
    try {
      const attachRes = await fetch(
        `/api/v1/leases/${encodeURIComponent(leaseId)}/documents/${encodeURIComponent(docId)}`,
        {
          method: "PATCH",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ storagePath }),
        },
      );
      const attachPayload = (await attachRes.json()) as { error?: string };
      if (!attachRes.ok) {
        setPhase("idle");
        setError(attachPayload.error ?? "Could not attach file.");
        return;
      }
    } catch {
      setPhase("idle");
      setError("Network error while attaching file.");
      return;
    }

    setPhase("idle");
    setFile(null);
    router.refresh();
  };

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 sm:p-5">
      {error ? (
        <div className="mb-4">
          <AuthMessage type="error" message={error} />
        </div>
      ) : null}

      {!canUpload ? (
        <p className="text-sm leading-relaxed text-slate-600">
          Supplemental uploads are available after structured analysis has{" "}
          <span className="font-medium text-slate-800">completed</span> for this lease. Current status:{" "}
          <span className="font-medium text-slate-800">{extractionStatus.replace(/_/g, " ")}</span>. You can track
          progress on the{" "}
          <Link href="/dashboard" className="font-semibold text-slate-900 underline underline-offset-2">
            dashboard
          </Link>
          .
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="supp-doc-type" className="text-sm font-medium text-slate-700">
                Instrument type
              </label>
              <select
                id="supp-doc-type"
                value={documentType}
                onChange={(e) => {
                  const v = e.target.value;
                  if (isLeaseDocumentType(v) && v !== "primary_lease") {
                    setDocumentType(v);
                    setError(null);
                  }
                }}
                disabled={busy}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-900 disabled:bg-slate-50"
              >
                {SUPPLEMENTAL_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {LEASE_DOCUMENT_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="supp-affected-area" className="text-sm font-medium text-slate-700">
                Affected lease area
              </label>
              <select
                id="supp-affected-area"
                value={affectedArea}
                onChange={(e) => setAffectedArea(e.target.value)}
                disabled={busy}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-900 disabled:bg-slate-50"
              >
                {LEASE_AFFECTED_AREAS.map((a) => (
                  <option key={a} value={a}>
                    {LEASE_AFFECTED_AREA_LABEL[a]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Affected area maps to structured fields used when merging this instrument after extraction.
          </p>

          <div className="space-y-1.5">
            <label htmlFor="supp-pdf" className="text-sm font-medium text-slate-700">
              PDF
            </label>
            <input
              id="supp-pdf"
              type="file"
              accept="application/pdf,.pdf"
              onChange={onFileChange}
              disabled={busy}
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-700 disabled:opacity-60"
            />
          </div>

          {phase !== "idle" ? (
            <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs font-medium text-slate-600">
              <span
                className="inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900"
                aria-hidden
              />
              <span>
                {phase === "creating"
                  ? "Creating document record…"
                  : phase === "uploading"
                    ? "Uploading PDF…"
                    : "Linking file…"}
              </span>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400 sm:w-auto"
          >
            {busy ? "Working…" : "Upload documents"}
          </button>
        </form>
      )}
    </div>
  );
}
