import Link from "next/link";

import type { DashboardLeaseRow } from "@/lib/dashboard/types";
import type { ExtractionStatus, OverallRisk } from "@/lib/supabase/database.types";

const riskStyles: Record<
  OverallRisk,
  { label: string; className: string }
> = {
  low: { label: "Low", className: "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200" },
  medium: {
    label: "Medium",
    className: "bg-amber-50 text-amber-900 ring-1 ring-inset ring-amber-200/80",
  },
  high: { label: "High", className: "bg-orange-50 text-orange-900 ring-1 ring-inset ring-orange-200/80" },
  critical: {
    label: "Critical",
    className: "bg-red-50 text-red-900 ring-1 ring-inset ring-red-200/80",
  },
};

const extractionStyles: Record<ExtractionStatus, { label: string; className: string }> = {
  uploading: { label: "Uploading", className: "text-slate-600" },
  extracting: { label: "Extracting", className: "text-sky-700" },
  analysing: { label: "Analysing", className: "text-violet-700" },
  complete: { label: "Ready", className: "text-emerald-700" },
  failed: { label: "Failed", className: "text-red-700" },
};

type LeasePortfolioTableProps = Readonly<{
  leases: DashboardLeaseRow[];
}>;

export function LeasePortfolioTable({ leases }: LeasePortfolioTableProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-900">Lease portfolio</h2>
        <p className="mt-0.5 text-sm text-slate-500">Next milestone from structured extraction (when available).</p>
      </div>
      {leases.length === 0 ? (
        <div className="px-5 py-16 text-center">
          <p className="text-sm text-slate-600">Upload your first lease to begin analysing critical dates.</p>
          <Link
            href="/upload"
            className="mt-4 inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Upload a lease
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3 font-medium">Property name</th>
                <th className="px-5 py-3 font-medium">Next critical action</th>
                <th className="px-5 py-3 font-medium">Days remaining</th>
                <th className="px-5 py-3 font-medium">Risk level</th>
                <th className="px-5 py-3 font-medium">Processing status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leases.map((lease) => {
                const risk = riskStyles[lease.riskLevel];
                const ex = extractionStyles[lease.extractionStatus];
                return (
                  <tr key={lease.id} className="transition hover:bg-slate-50/60">
                    <td className="whitespace-nowrap px-5 py-3.5 font-medium text-slate-900">
                      <Link
                        href={`/lease/${lease.id}`}
                        className="text-slate-900 underline decoration-slate-300 underline-offset-2 hover:text-slate-700"
                      >
                        {lease.propertyName}
                      </Link>
                    </td>
                    <td className="max-w-[220px] px-5 py-3.5 text-slate-600">{lease.nextCriticalAction}</td>
                    <td className="whitespace-nowrap px-5 py-3.5 tabular-nums text-slate-700">
                      {lease.daysRemaining === null ? "—" : lease.daysRemaining}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5">
                      <span
                        className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${risk.className}`}
                      >
                        {risk.label}
                      </span>
                    </td>
                    <td className={`whitespace-nowrap px-5 py-3.5 text-sm font-medium ${ex.className}`}>
                      {ex.label}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
