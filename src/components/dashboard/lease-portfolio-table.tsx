"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { KeyboardEvent } from "react";

import { LeaseExtractionProgress } from "@/components/dashboard/lease-extraction-progress";
import type { DashboardLeaseRow } from "@/lib/dashboard/types";
import type { LeaseNextActionUrgency, OverallRisk } from "@/lib/supabase/database.types";

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

const urgencyStyles: Record<
  LeaseNextActionUrgency,
  { label: string; className: string }
> = {
  low: { label: "Low", className: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200" },
  medium: { label: "Medium", className: "bg-sky-50 text-sky-900 ring-1 ring-inset ring-sky-200/80" },
  high: { label: "High", className: "bg-amber-50 text-amber-950 ring-1 ring-inset ring-amber-200/80" },
  critical: { label: "Critical", className: "bg-red-50 text-red-950 ring-1 ring-inset ring-red-200/80" },
};

type LeasePortfolioTableProps = Readonly<{
  leases: DashboardLeaseRow[];
}>;

export function LeasePortfolioTable({ leases }: LeasePortfolioTableProps) {
  const router = useRouter();

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-900">Lease portfolio</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Next action from structured data (break notice → rent review → expiry → manual review). Saved after
          analysis completes. Live extraction progress updates while you stay on this page; click any row for the
          lease detail page.
        </p>
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
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3 font-medium">Property name</th>
                <th className="px-5 py-3 font-medium">Next critical action</th>
                <th className="px-5 py-3 font-medium">Action date</th>
                <th className="px-5 py-3 font-medium">Days remaining</th>
                <th className="px-5 py-3 font-medium">Urgency</th>
                <th className="px-5 py-3 font-medium">Risk level</th>
                <th className="px-5 py-3 font-medium">Extraction progress</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leases.map((lease) => {
                const risk = riskStyles[lease.riskLevel];
                const urg =
                  lease.urgencyLevel != null ? urgencyStyles[lease.urgencyLevel] : null;
                const href = `/lease/${lease.id}`;

                const go = () => {
                  router.push(href);
                };

                const onRowKeyDown = (e: KeyboardEvent<HTMLTableRowElement>) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    go();
                  }
                };

                return (
                  <tr
                    key={lease.id}
                    role="link"
                    tabIndex={0}
                    aria-label={`Open lease: ${lease.propertyName}`}
                    className="cursor-pointer transition hover:bg-slate-50/60 focus-visible:bg-slate-50/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-slate-400"
                    onClick={go}
                    onKeyDown={onRowKeyDown}
                  >
                    <td className="whitespace-nowrap px-5 py-3.5 font-medium text-slate-900">
                      <span className="text-slate-900 underline decoration-slate-300 underline-offset-2">
                        {lease.propertyName}
                      </span>
                    </td>
                    <td className="max-w-[220px] px-5 py-3.5 text-slate-600">{lease.nextCriticalAction}</td>
                    <td className="whitespace-nowrap px-5 py-3.5 tabular-nums text-slate-700">
                      {lease.actionDate ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 tabular-nums text-slate-700">
                      {lease.daysRemaining === null ? "—" : lease.daysRemaining}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5">
                      {urg ? (
                        <span
                          className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${urg.className}`}
                        >
                          {urg.label}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5">
                      <span
                        className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${risk.className}`}
                      >
                        {risk.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 align-top">
                      <LeaseExtractionProgress status={lease.extractionStatus} />
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
