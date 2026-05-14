"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

import type { DashboardAlertRow } from "@/lib/dashboard/types";

const severityDot: Record<DashboardAlertRow["severity"], string> = {
  info: "bg-slate-400",
  warning: "bg-amber-500",
  critical: "bg-red-500",
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

type UpcomingAlertsPanelProps = Readonly<{
  alerts: DashboardAlertRow[];
}>;

export function UpcomingAlertsPanel({ alerts }: UpcomingAlertsPanelProps) {
  const [openLeaseId, setOpenLeaseId] = useState<string | null>(null);

  const toggle = useCallback((leaseId: string) => {
    setOpenLeaseId((prev) => (prev === leaseId ? null : leaseId));
  }, []);

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-900">Upcoming actions</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Next step per lease. When there are further actions, click the row to reveal the other actions in
          priority order (breaks → rent reviews → expiry → manual review).
        </p>
      </div>
      {alerts.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-slate-600">
          No dated actions or manual-review flags yet. They appear after structured analysis completes.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 p-2">
          {alerts.map((alert) => {
            const primary = alert.allActionsInPriorityOrder[0]!;
            const expandable = alert.allActionsInPriorityOrder.length > 1;
            const open = openLeaseId === alert.leaseId;

            const summaryBody = (
              <>
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${severityDot[alert.severity]}`}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-snug text-slate-900">{alert.propertyName}</p>
                  <p className="mt-0.5 text-xs font-medium text-slate-700">{primary.label}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{primary.dueLabel}</p>
                </div>
              </>
            );

            return (
              <li key={alert.id}>
                <div className="flex items-start gap-1 rounded-lg px-1 py-1">
                  {expandable ? (
                    <button
                      type="button"
                      onClick={() => toggle(alert.leaseId)}
                      aria-expanded={open}
                      aria-label={
                        open
                          ? `Hide other actions for ${alert.propertyName}`
                          : `Reveal other actions for ${alert.propertyName}`
                      }
                      className="flex min-w-0 flex-1 items-start gap-2 rounded-lg px-2 py-2.5 text-left transition hover:bg-slate-50"
                    >
                      <ChevronIcon open={open} />
                      {summaryBody}
                    </button>
                  ) : (
                    <div className="flex min-w-0 flex-1 items-start gap-2 px-2 py-2.5">
                      <span className="mt-0.5 w-4 shrink-0" aria-hidden />
                      {summaryBody}
                    </div>
                  )}
                  <Link
                    href={`/lease/${alert.leaseId}`}
                    className="mt-2 shrink-0 self-start rounded-md px-2 py-1 text-xs font-medium text-slate-600 underline decoration-slate-300 underline-offset-2 hover:bg-slate-100 hover:text-slate-900"
                  >
                    View
                  </Link>
                </div>

                {expandable && open ? (
                  <ul className="mb-2 ml-4 space-y-2 border-l-2 border-slate-200 py-1 pl-4">
                    {alert.allActionsInPriorityOrder.slice(1).map((item, idx) => (
                      <li key={`${alert.id}-action-${idx + 1}`} className="flex gap-2 text-sm">
                        <span
                          className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${severityDot[item.severity]}`}
                          aria-hidden
                        />
                        <div className="min-w-0">
                          <p className="font-medium text-slate-800">{item.label}</p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {item.actionDate ? (
                              <>
                                <span className="font-mono tabular-nums text-slate-600">{item.actionDate}</span>
                                <span className="mx-1 text-slate-300">·</span>
                              </>
                            ) : null}
                            {item.dueLabel}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
