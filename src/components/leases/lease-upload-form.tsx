"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { AuthMessage } from "@/components/auth/auth-message";
import { PROPERTY_TYPES } from "@/lib/lease/property-types";
import { validatePdfFile } from "@/lib/lease/validate-pdf";
import { getPublicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/client";
import { uploadPdfToSignedUrl } from "@/lib/storage/upload-to-signed-url";

const BUCKET = "leases";

export function LeaseUploadForm() {
  const router = useRouter();
  const [propertyName, setPropertyName] = useState("");
  const [propertyType, setPropertyType] = useState<string>(PROPERTY_TYPES[0].value);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"idle" | "uploading" | "saving">("idle");
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

    const { NEXT_PUBLIC_SUPABASE_ANON_KEY: apiKey } = getPublicEnv();

    const objectName = `${crypto.randomUUID()}.pdf`;
    const storagePath = `${user.id}/${objectName}`;

    setPhase("uploading");
    setProgress(0);

    const { data: signed, error: signError } = await supabase.storage
      .from(BUCKET)
      .createSignedUploadUrl(storagePath);

    if (signError || !signed?.signedUrl) {
      setPhase("idle");
      setError(signError?.message ?? "Could not start upload.");
      return;
    }

    try {
      await uploadPdfToSignedUrl({
        signedUrl: signed.signedUrl,
        file,
        accessToken: session.access_token,
        apiKey,
        onProgress: (loaded, total) => {
          if (total > 0) {
            setProgress(Math.round((loaded / total) * 100));
          }
        },
      });
      setProgress(100);
    } catch (uploadErr) {
      setPhase("idle");
      setProgress(0);
      setError(uploadErr instanceof Error ? uploadErr.message : "Upload failed.");
      return;
    }

    setPhase("saving");

    let leaseId: string;
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
          storagePath,
        }),
      });
      const payload = (await response.json()) as { leaseId?: string; error?: string };

      if (!response.ok) {
        setPhase("idle");
        setProgress(0);
        setError(payload.error ?? "Could not save lease.");
        return;
      }

      if (!payload.leaseId) {
        setPhase("idle");
        setProgress(0);
        setError("Missing lease id from server.");
        return;
      }

      leaseId = payload.leaseId;
    } catch {
      setPhase("idle");
      setProgress(0);
      setError("Could not save lease (network error).");
      return;
    }

    setPhase("idle");
    router.push(`/upload/processing?lease_id=${encodeURIComponent(leaseId)}`);
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
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-medium text-slate-600">
            <span>{phase === "uploading" ? "Uploading file…" : "Saving lease…"}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-slate-900 transition-[width] duration-150 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
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
