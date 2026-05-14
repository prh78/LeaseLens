"use client";

import Link from "next/link";
import { Fragment, useCallback, useState, type KeyboardEvent, type MouseEvent } from "react";
import { useRouter } from "next/navigation";

import { LeaseExtractionProgress } from "@/components/dashboard/lease-extraction-progress";
import type { DashboardLeaseRow, DashboardUpcomingActionItem } from "@/lib/dashboard/types";
import type { LeaseTermStatus } from "@/lib/lease/lease-term-status";
import type { LeaseNextActionUrgency, OverallRisk } from "@/lib/supabase/database.types";

const NO_LEASE_NAV = "[data-no-lease-nav]";

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

const severityDot: Record<DashboardUpcomingActionItem["severity"], string> = {
  info: "bg-slate-400",
  warning: "bg-amber-500",
  critical: "bg-red-500",
};

const termStyles: Record<LeaseTermStatus, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-emerald-50 text-emerald-900 ring-1 ring-inset ring-emerald-200/80" },
  expired: { label: "Expired", className: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200" },
  unknown: { label: "Unknown", className: "bg-slate-50 text-slate-500 ring-1 ring-inset ring-slate-200/90" },
};

function ChevronIcon({ open }: Readonly<{ open: boolean }>) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
      className={`mt-0.5 size-4 shrink-0 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
    >
      <path
        fillRule="evenodd"
        d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

type LeasePortfolioTableProps = Readonly<{
  leases: DashboardLeaseRow[];
}>;

export function LeasePortfolioTable({ leases }: LeasePortfolioTableProps) {
  const router = useRouter();
  const [expandedLeaseId, setExpandedLeaseId] = useState<string | null>(null);

  const toggleActions = useCallback((leaseId: string) => {
    setExpandedLeaseId((prev) => (prev === leaseId ? null : leaseId));
  }, []);

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-900">Lease portfolio</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Next action from structured data (break notice → rent review → expiry → manual review). When there are
          further actions for a lease, use the control in{" "}
          <span className="font-medium text-slate-600">Next critical action</span> to reveal the rest in priority order
          (not shown for expired terms). Click elsewhere on the row to open the lease. Live extraction progress updates
          while you stay on this page.
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
          <table className="w-full min-w-[1040px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3 font-medium">Property name</th>
                <th className="px-5 py-3 font-medium">Term</th>
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
                const term = termStyles[lease.termStatus];
                const isExpired = lease.termStatus === "expired";

                const go = () => {
                  router.push(href);
                };

                const onRowMouseDown = (e: MouseEvent<HTMLTableRowElement>) => {
                  if ((e.target as HTMLElement).closest(NO_LEASE_NAV)) {
                    return;
                  }
                  go();
                };

                const onRowKeyDown = (e: KeyboardEvent<HTMLTableRowElement>) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    go();
                  }
                };

                const primary = isExpired ? undefined : lease.allActionsInPriorityOrder[0];
                const expandable = !isExpired && lease.allActionsInPriorityOrder.length > 1;
                const open = expandedLeaseId === lease.id;

                const actionSummary = primary ? (
                  <div className="flex min-w-0 items-start gap-2">
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${severityDot[primary.severity]}`}
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <p className="font-medium leading-snug text-slate-900">{primary.label}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{primary.dueLabel}</p>
                    </div>
                  </div>
                ) : (
                  <span className="text-slate-400">—</span>
                );

                return (
                  <Fragment key={lease.id}>
                    <tr
                      role="link"
                      tabIndex={0}
                      aria-label={`Open lease: ${lease.propertyName}`}
                      className="cursor-pointer transition hover:bg-slate-50/60 focus-visible:bg-slate-50/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-slate-400"
                      onMouseDown={onRowMouseDown}
                      onKeyDown={onRowKeyDown}
                    >
                      <td className="whitespace-nowrap px-5 py-3.5 font-medium text-slate-900">
                        <span className="text-slate-900 underline decoration-slate-300 underline-offset-2">
                          {lease.propertyName}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 align-top">
                        <span
                          className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${term.className}`}
                        >
                          {term.label}
                        </span>
                      </td>
                      <td className="max-w-[280px] px-5 py-3.5 align-top text-slate-600">
                        {isExpired ? (
                          <span className="sr-only">No next critical action; lease term has expired.</span>
                        ) : primary ? (
                          <div data-no-lease-nav className="flex items-start gap-1">
                            {expandable ? (
                              <button
                                type="button"
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={() => toggleActions(lease.id)}
                                aria-expanded={open}
                                aria-label={
                                  open
                                    ? `Hide other actions for ${lease.propertyName}`
                                    : `Reveal other actions for ${lease.propertyName}`
                                }
                                className="flex min-w-0 flex-1 items-start gap-2 rounded-lg px-1 py-0.5 text-left text-inherit transition hover:bg-slate-100/80"
                              >
                                <ChevronIcon open={open} />
                                {actionSummary}
                              </button>
                            ) : (
                              <div className="flex min-w-0 items-start gap-2 pl-1">{actionSummary}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 tabular-nums text-slate-700">
                        {isExpired ? "" : lease.actionDate ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 tabular-nums text-slate-700">
                        {isExpired ? "" : lease.daysRemaining === null ? "—" : lease.daysRemaining}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5">
                        {isExpired ? null : urg ? (
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
                    {expandable && open ? (
                      <tr className="bg-slate-50/60">
                        <td colSpan={8} className="px-5 py-3" data-no-lease-nav>
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Further actions (priority order)
                          </p>
                          <ul className="space-y-2 border-l-2 border-slate-200 py-0.5 pl-4">
                            {lease.allActionsInPriorityOrder.slice(1).map((item, idx) => (
                              <li key={`${lease.id}-extra-${idx}`} className="flex gap-2 text-sm">
                                <span
                                  className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${severityDot[item.severity]}`}
                                  aria-hidden
                                />
                                <div className="min-w-0">
                                  <p className="font-medium text-slate-800">{item.label}</p>
                                  <p className="mt-0.5 text-xs text-slate-500">
                                    {item.actionDate ? (
                                      <>
                                        <span className="font-mono tabular-nums text-slate-600">
                                          {item.actionDate}
                                        </span>
                                        <span className="mx-1 text-slate-300">·</span>
                                      </>
                                    ) : null}
                                    {item.dueLabel}
                                  </p>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
