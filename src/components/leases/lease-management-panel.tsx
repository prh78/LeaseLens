"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { AuthMessage } from "@/components/auth/auth-message";
import { LeaseDetailSection } from "@/components/leases/lease-detail-section";
import { createClient } from "@/lib/supabase/client";

type LeaseManagementPanelProps = Readonly<{
  leaseId: string;
  initialPropertyName: string;
  /** Count of supplemental `lease_documents` rows (including rows still uploading). */
  supplementalCount: number;
}>;

export function LeaseManagementPanel({
  leaseId,
  initialPropertyName,
  supplementalCount,
}: LeaseManagementPanelProps) {
  const router = useRouter();
  const [name, setName] = useState(initialPropertyName);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(initialPropertyName);
  }, [initialPropertyName]);

  const getAccessToken = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }, []);

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

      setEditing(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const deleteAllSupplementals = async () => {
    if (
      !window.confirm(
        "Remove all supplemental documents for this lease? The primary lease PDF stays. Storage files and database rows for those documents will be deleted, and text extraction will run again.",
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

      const res = await fetch(`/api/v1/leases/${encodeURIComponent(leaseId)}/documents`, {
        method: "DELETE",
        credentials: "same-origin",
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = (await res.json()) as { error?: string; deletedCount?: number };
      if (!res.ok) {
        setError(payload.error ?? "Could not remove supplemental documents.");
        return;
      }

      router.refresh();
    } finally {
      setBusy(false);
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

  return (
    <LeaseDetailSection
      title="Property & documents"
      description="Rename the listing, remove supplemental instruments, or delete the entire lease from your portfolio."
    >
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
                setEditing(true);
              }}
              disabled={busy}
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-900 disabled:bg-slate-50"
            />
            {editing ? (
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    void savePropertyName();
                  }}
                  className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  Save name
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setName(initialPropertyName);
                    setEditing(false);
                    setError(null);
                  }}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="border-t border-slate-100 pt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Danger zone</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {supplementalCount > 0 ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  void deleteAllSupplementals();
                }}
                className="rounded-lg border border-amber-300 bg-amber-50/80 px-3 py-2 text-sm font-semibold text-amber-950 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Delete all supplemental documents
              </button>
            ) : null}
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
    </LeaseDetailSection>
  );
}
