"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { AuthMessage } from "@/components/auth/auth-message";
import { useDisplayLocale } from "@/components/providers/display-locale-provider";
import {
  LEASE_DOCUMENT_TYPES,
  LEASE_DOCUMENT_TYPE_LABEL,
  isLeaseDocumentType,
} from "@/lib/lease/lease-document-types";
import { formatIsoDate } from "@/lib/lease/lease-detail";
import { leaseDocumentPdfStoragePath, leasePdfStoragePath } from "@/lib/lease/lease-storage-path";
import type { LeaseTermStatus } from "@/lib/lease/lease-term-status";
import { LEASE_JURISDICTION_LABEL, LEASE_JURISDICTIONS } from "@/lib/lease/jurisdiction/types";
import { PROPERTY_TYPES } from "@/lib/lease/property-types";
import {
  LEASE_AFFECTED_AREA_LABEL,
  LEASE_AFFECTED_AREAS,
  isLeaseAffectedArea,
  supersedesFieldsJsonFromArea,
} from "@/lib/lease/upload-affected-area";
import { validatePdfFile } from "@/lib/lease/validate-pdf";
import { createClient } from "@/lib/supabase/client";
import type { LeaseDocumentType } from "@/lib/supabase/database.types";

const BUCKET = "leases";

type LeaseRow = Readonly<{
  id: string;
  property_name: string;
  extraction_status: string;
  term_status: LeaseTermStatus;
  expiry_date: string | null;
}>;

function leasePickerOptionLabel(l: LeaseRow, locale: string): string {
  const name = l.property_name;
  if (l.term_status === "expired") {
    const formatted = formatIsoDate(l.expiry_date, locale);
    return formatted ? `${name} (Expired · ${formatted})` : `${name} (Expired)`;
  }
  if (l.term_status === "unknown") {
    return `${name} (Term unknown)`;
  }
  return `${name} (Active)`;
}

export function LeaseUploadForm() {
  const router = useRouter();
  const displayLocale = useDisplayLocale();
  const [documentType, setDocumentType] = useState<LeaseDocumentType>("primary_lease");
  const [propertyName, setPropertyName] = useState("");
  const [propertyType, setPropertyType] = useState<string>(PROPERTY_TYPES[0].value);
  const [leaseJurisdiction, setLeaseJurisdiction] = useState<string>("uk");
  const [leaseId, setLeaseId] = useState("");
  const [affectedArea, setAffectedArea] = useState<string>("lease_term");
  const [leases, setLeases] = useState<LeaseRow[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<"idle" | "saving" | "creating" | "uploading" | "attaching">("idle");
  const [error, setError] = useState<string | null>(null);

  const busy = phase !== "idle";
  const isPrimary = documentType === "primary_lease";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        return;
      }
      try {
        const res = await fetch("/api/v1/leases", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const payload = (await res.json()) as {
          leases?: {
            id: string;
            property_name: string;
            extraction_status: string;
            term_status?: LeaseTermStatus;
            expiry_date?: string | null;
          }[];
          error?: string;
        };
        if (!res.ok) {
          if (!cancelled) {
            setLoadErr(payload.error ?? "Could not load leases.");
          }
          return;
        }
        if (!cancelled) {
          setLeases(
            (payload.leases ?? []).map((r) => ({
              id: r.id,
              property_name: r.property_name,
              extraction_status: r.extraction_status,
              term_status: r.term_status ?? "unknown",
              expiry_date: r.expiry_date ?? null,
            })),
          );
          setLoadErr(null);
        }
      } catch {
        if (!cancelled) {
          setLoadErr("Could not load leases.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.target.files?.[0] ?? null;
    setFile(next);
    setError(null);
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!file) {
      setError("Choose a PDF to upload.");
      return;
    }

    const pdfCheck = await validatePdfFile(file);
    if (!pdfCheck.ok) {
      setError(pdfCheck.message);
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

    if (isPrimary) {
      if (!propertyName.trim()) {
        setError("Enter a property name.");
        return;
      }

      setPhase("saving");

      let newLeaseId: string;
      let primaryLeaseDocumentId: string | undefined;
      try {
        const response = await fetch("/api/v1/leases", {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            propertyName: propertyName.trim(),
            propertyType,
            leaseJurisdiction,
          }),
        });
        const payload = (await response.json()) as {
          leaseId?: string;
          primaryLeaseDocumentId?: string;
          error?: string;
        };

        if (!response.ok) {
          setPhase("idle");
          setError(payload.error ?? "Could not save lease.");
          return;
        }

        if (!payload.leaseId) {
          setPhase("idle");
          setError("Missing lease id from server.");
          return;
        }

        newLeaseId = payload.leaseId;
        primaryLeaseDocumentId = payload.primaryLeaseDocumentId;
      } catch {
        setPhase("idle");
        setError("Could not save lease (network error).");
        return;
      }

      const storagePath = primaryLeaseDocumentId
        ? leaseDocumentPdfStoragePath(user.id, newLeaseId, primaryLeaseDocumentId)
        : leasePdfStoragePath(user.id, newLeaseId);

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
        const attachRes = await fetch(`/api/v1/leases/${encodeURIComponent(newLeaseId)}`, {
          method: "PATCH",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ storagePath }),
        });
        const attachPayload = (await attachRes.json()) as { error?: string };

        if (!attachRes.ok) {
          setPhase("idle");
          setError(attachPayload.error ?? "Could not attach file to lease.");
          return;
        }
      } catch {
        setPhase("idle");
        setError("Could not attach file (network error).");
        return;
      }

      setPhase("idle");
      router.push("/dashboard");
      router.refresh();
      return;
    }

    if (!leaseId) {
      setError("Select the lease this document relates to.");
      return;
    }

    if (!isLeaseDocumentType(documentType)) {
      setError("Invalid document type.");
      return;
    }

    if (!isLeaseAffectedArea(affectedArea)) {
      setError("Invalid affected lease area.");
      return;
    }

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
    router.push(`/lease/${leaseId}`);
    router.refresh();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto max-w-lg space-y-6 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm"
    >
      {loadErr ? <AuthMessage type="error" message={loadErr} /> : null}
      {error ? <AuthMessage type="error" message={error} /> : null}

      <div className="space-y-2">
        <label htmlFor="upload-doc-type" className="text-sm font-medium text-slate-700">
          Document type
        </label>
        <select
          id="upload-doc-type"
          value={documentType}
          onChange={(e) => {
            const v = e.target.value;
            if (isLeaseDocumentType(v)) {
              setDocumentType(v);
              setError(null);
            }
          }}
          disabled={busy}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-900 disabled:bg-slate-50"
        >
          {LEASE_DOCUMENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {LEASE_DOCUMENT_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
        <p className="text-xs text-slate-500">
          {isPrimary
            ? "Creates a new property record with the primary lease PDF."
            : "Adds an instrument to an existing lease. The lease will re-enter extraction for merged analysis."}
        </p>
      </div>

      {isPrimary ? (
        <>
          <div className="space-y-2">
            <label htmlFor="property-name" className="text-sm font-medium text-slate-700">
              Property name
            </label>
            <input
              id="property-name"
              type="text"
              required
              maxLength={500}
              value={propertyName}
              onChange={(event) => setPropertyName(event.target.value)}
              disabled={busy}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-900 disabled:bg-slate-50"
              placeholder="e.g. 120 Fleet Street"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="property-type" className="text-sm font-medium text-slate-700">
              Property type
            </label>
            <select
              id="property-type"
              value={propertyType}
              onChange={(event) => setPropertyType(event.target.value)}
              disabled={busy}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-900 disabled:bg-slate-50"
            >
              {PROPERTY_TYPES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="lease-jurisdiction" className="text-sm font-medium text-slate-700">
              Lease jurisdiction
            </label>
            <select
              id="lease-jurisdiction"
              value={leaseJurisdiction}
              onChange={(event) => setLeaseJurisdiction(event.target.value)}
              disabled={busy}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-900 disabled:bg-slate-50"
            >
              {LEASE_JURISDICTIONS.map((code) => (
                <option key={code} value={code}>
                  {LEASE_JURISDICTION_LABEL[code]}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500">
              Guides AI extraction terminology and notice-period handling. Existing leases default to United Kingdom.
            </p>
          </div>
        </>
      ) : (
        <>
          <div className="space-y-2">
            <label htmlFor="target-lease" className="text-sm font-medium text-slate-700">
              Lease
            </label>
            <select
              id="target-lease"
              value={leaseId}
              onChange={(e) => setLeaseId(e.target.value)}
              disabled={busy}
              required
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-900 disabled:bg-slate-50"
            >
              <option value="">Select lease…</option>
              {leases
                .filter((l) => l.extraction_status === "complete")
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    {leasePickerOptionLabel(l, displayLocale)}
                  </option>
                ))}
            </select>
            <p className="text-xs text-slate-500">Only completed leases accept supplemental uploads.</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="affected-area" className="text-sm font-medium text-slate-700">
              Affected lease area
            </label>
            <select
              id="affected-area"
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
            <p className="text-xs text-slate-500">Maps to structured fields used when merging this instrument.</p>
          </div>
        </>
      )}

      <div className="space-y-2">
        <label htmlFor="lease-pdf" className="text-sm font-medium text-slate-700">
          PDF
        </label>
        <input
          id="lease-pdf"
          type="file"
          accept="application/pdf,.pdf"
          onChange={onFileChange}
          disabled={busy}
          className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-700 disabled:opacity-60"
        />
        <p className="text-xs text-slate-500">PDF only, up to 50 MB (per project storage settings).</p>
      </div>

      {phase !== "idle" ? (
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-medium text-slate-600">
          <span
            className="inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900"
            aria-hidden
          />
          <span>
            {phase === "saving"
              ? "Creating lease record…"
              : phase === "creating"
                ? "Creating document record…"
                : phase === "uploading"
                  ? "Uploading PDF to secure storage…"
                  : "Linking file…"}
          </span>
        </div>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        {busy ? "Working…" : isPrimary ? "Upload primary lease" : "Upload supplemental document"}
      </button>
    </form>
  );
}
