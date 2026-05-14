import Link from "next/link";

import { UrgencyBadge } from "@/components/dashboard/urgency-badge";
import type { DashboardDeadlineAlert } from "@/lib/dashboard/types";

type LeaseDeadlineAlertsProps = Readonly<{
  alerts: readonly DashboardDeadlineAlert[];
}>;

export function LeaseDeadlineAlerts({ alerts }: LeaseDeadlineAlertsProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-900">Critical lease events</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Actionable milestones from extracted dates—nearest due dates first. Click a row to open the lease.
        </p>
      </div>
      {alerts.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-slate-600">
          No critical lease events currently scheduled.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3 font-medium">Property name</th>
                <th className="px-5 py-3 font-medium">Event type</th>
                <th className="px-5 py-3 font-medium">Due date</th>
                <th className="px-5 py-3 font-medium">Urgency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {alerts.map((alert) => (
                <tr key={`${alert.leaseId}-${alert.eventType}-${alert.dueDate}`} className="transition hover:bg-slate-50/60">
                  <td className="whitespace-nowrap px-5 py-3.5 font-medium text-slate-900">
                    <Link
                      href={`/lease/${alert.leaseId}`}
                      className="text-slate-900 underline decoration-slate-300 underline-offset-2 hover:text-slate-700"
                    >
                      {alert.propertyName}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5 text-slate-700">{alert.eventType}</td>
                  <td className="whitespace-nowrap px-5 py-3.5 tabular-nums text-slate-700">{alert.dueDate}</td>
                  <td className="whitespace-nowrap px-5 py-3.5">
                    <UrgencyBadge level={alert.urgencyLevel} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
