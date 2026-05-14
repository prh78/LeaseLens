"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { AuthMessage } from "@/components/auth/auth-message";
import { PROPERTY_TYPES } from "@/lib/lease/property-types";
import { leaseDocumentPdfStoragePath, leasePdfStoragePath } from "@/lib/lease/lease-storage-path";
import { validatePdfFile } from "@/lib/lease/validate-pdf";
import { createClient } from "@/lib/supabase/client";

const BUCKET = "leases";

export function LeaseUploadForm() {
  const router = useRouter();
  const [propertyName, setPropertyName] = useState("");
  const [propertyType, setPropertyType] = useState<string>(PROPERTY_TYPES[0].value);
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<"idle" | "saving" | "uploading" | "attaching">("idle");
  const [error, setError] = useState<string | null>(null);

  const busy = phase !== "idle";

  const onFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.target.files?.[0] ?? null;
    setFile(next);
    setError(null);
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!file) {
      setError("Choose a PDF lease to upload.");
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

    setPhase("saving");

    let leaseId: string;
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

      leaseId = payload.leaseId;
      primaryLeaseDocumentId = payload.primaryLeaseDocumentId;
    } catch {
      setPhase("idle");
      setError("Could not save lease (network error).");
      return;
    }

    const storagePath = primaryLeaseDocumentId
      ? leaseDocumentPdfStoragePath(user.id, leaseId, primaryLeaseDocumentId)
      : leasePdfStoragePath(user.id, leaseId);

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
      const attachRes = await fetch(`/api/v1/leases/${encodeURIComponent(leaseId)}`, {
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
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-lg space-y-6">
      {error ? <AuthMessage type="error" message={error} /> : null}

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
        <label htmlFor="lease-pdf" className="text-sm font-medium text-slate-700">
          Lease PDF
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
              : phase === "uploading"
                ? "Uploading PDF to secure storage…"
                : "Linking file to lease…"}
          </span>
        </div>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        {busy ? "Working…" : "Upload lease"}
      </button>
    </form>
  );
}
