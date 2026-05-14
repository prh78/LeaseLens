"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AuthMessage } from "@/components/auth/auth-message";
import { LeaseDetailSection } from "@/components/leases/lease-detail-section";
import { LEASE_DOCUMENT_TYPE_LABEL } from "@/lib/lease/lease-document-types";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/database.types";

type LeaseManagementPanelProps = Readonly<{
  leaseId: string;
  initialPropertyName: string;
  documents: readonly Tables<"lease_documents">[];
}>;

export function LeaseManagementPanel({ leaseId, initialPropertyName, documents }: LeaseManagementPanelProps) {
  const router = useRouter();
  const [panelOpen, setPanelOpen] = useState(false);
  const [name, setName] = useState(initialPropertyName);
  const [nameDirty, setNameDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(initialPropertyName);
    setNameDirty(false);
  }, [initialPropertyName]);

  const orderedDocuments = useMemo(() => {
    return [...documents].sort((a, b) => new Date(a.upload_date).getTime() - new Date(b.upload_date).getTime());
  }, [documents]);

  const getAccessToken = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }, []);

  const closePanel = useCallback(() => {
    const trimmed = name.trim();
    const initialTrim = initialPropertyName.trim();
    if (nameDirty && trimmed !== initialTrim) {
      if (!window.confirm("Discard unsaved changes to the property name?")) {
        return;
      }
    }
    setName(initialPropertyName);
    setNameDirty(false);
    setError(null);
    setPanelOpen(false);
  }, [initialPropertyName, name, nameDirty]);

  const savePropertyName = async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 500) {
      setError("Property name is required (max 500 characters).");
      return;
    }

    setError(null);
    setBusy(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        setError("You must be signed in.");
        return;
      }

      const res = await fetch(`/api/v1/leases/${encodeURIComponent(leaseId)}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ propertyName: trimmed }),
      });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(payload.error ?? "Could not update property name.");
        return;
      }

      setNameDirty(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const deleteDocument = async (doc: Tables<"lease_documents">) => {
    const typeLabel = LEASE_DOCUMENT_TYPE_LABEL[doc.document_type];
    if (
      !window.confirm(
        `Delete this ${typeLabel} and its stored file? Text extraction will run again for the remaining documents.`,
      )
    ) {
      return;
    }

    setError(null);
    setDeletingDocId(doc.id);
    try {
      const token = await getAccessToken();
      if (!token) {
        setError("You must be signed in.");
        return;
      }

      const res = await fetch(
        `/api/v1/leases/${encodeURIComponent(leaseId)}/documents/${encodeURIComponent(doc.id)}`,
        {
          method: "DELETE",
          credentials: "same-origin",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(payload.error ?? "Could not delete document.");
        return;
      }

      router.refresh();
    } finally {
      setDeletingDocId(null);
    }
  };

  const deleteEntireLease = async () => {
    if (
      !window.confirm(
        "Permanently delete this lease and all related data (documents, extracted fields, alerts)? This cannot be undone.",
      )
    ) {
      return;
    }

    setError(null);
    setBusy(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        setError("You must be signed in.");
        return;
      }

      const res = await fetch(`/api/v1/leases/${encodeURIComponent(leaseId)}`, {
        method: "DELETE",
        credentials: "same-origin",
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(payload.error ?? "Could not delete lease.");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const headerToggle = (
    <button
      type="button"
      onClick={() => {
        if (panelOpen) {
          closePanel();
        } else {
          setError(null);
          setPanelOpen(true);
        }
      }}
      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
    >
      {panelOpen ? "Done" : "Edit"}
    </button>
  );

  return (
    <LeaseDetailSection
      title="Property & documents"
      description="Rename the listing, remove individual PDFs, or delete the entire lease from your portfolio."
      headerRight={headerToggle}
    >
      {!panelOpen ? (
        <p className="text-sm text-slate-600">
          Options are hidden until you choose <span className="font-medium text-slate-800">Edit</span>.
        </p>
      ) : (
        <div className="space-y-6">
          {error ? <AuthMessage type="error" message={error} /> : null}

          <div className="space-y-2">
            <label htmlFor="lease-property-name" className="text-sm font-medium text-slate-700">
              Property name
            </label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                id="lease-property-name"
                type="text"
                maxLength={500}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setNameDirty(true);
                }}
                disabled={busy}
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-900 disabled:bg-slate-50"
              />
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy || !nameDirty}
                  onClick={() => {
                    void savePropertyName();
                  }}
                  className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  Save name
                </button>
                <button
                  type="button"
                  disabled={busy || !nameDirty}
                  onClick={() => {
                    setName(initialPropertyName);
                    setNameDirty(false);
                    setError(null);
                  }}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Uploaded documents</p>
            <p className="mt-1 text-sm text-slate-600">
              Delete removes the file from storage and the document record. The primary lease cannot be removed here;
              use <span className="font-medium text-slate-800">Delete entire lease</span> below to remove it.
            </p>
            <ul className="mt-4 space-y-3">
              {orderedDocuments.map((doc) => {
                const label =
                  doc.display_name?.trim() ||
                  `${LEASE_DOCUMENT_TYPE_LABEL[doc.document_type]} · ${new Date(doc.upload_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
                const isPrimary = doc.document_type === "primary_lease";
                const deleting = deletingDocId === doc.id;

                return (
                  <li
                    key={doc.id}
                    className="flex flex-col gap-2 rounded-lg border border-slate-100 bg-slate-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">{label}</p>
                      <p className="text-xs text-slate-500">{LEASE_DOCUMENT_TYPE_LABEL[doc.document_type]}</p>
                    </div>
                    {isPrimary ? (
                      <span className="text-xs text-slate-500 sm:text-right">Not removable individually</span>
                    ) : (
                      <button
                        type="button"
                        disabled={busy || deleting}
                        onClick={() => {
                          void deleteDocument(doc);
                        }}
                        className="shrink-0 rounded-lg border border-red-200 bg-red-50/90 px-3 py-1.5 text-xs font-semibold text-red-900 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deleting ? "Deleting…" : "Delete"}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
            {orderedDocuments.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">No document rows on file.</p>
            ) : null}
          </div>

          <div className="border-t border-slate-100 pt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Danger zone</p>
            <div className="mt-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  void deleteEntireLease();
                }}
                className="rounded-lg border border-red-300 bg-red-50/90 px-3 py-2 text-sm font-semibold text-red-950 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Delete entire lease
              </button>
            </div>
          </div>
        </div>
      )}
    </LeaseDetailSection>
  );
}
