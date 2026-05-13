import type { DashboardAlertRow } from "@/lib/dashboard/types";

const severityDot: Record<DashboardAlertRow["severity"], string> = {
  info: "bg-slate-400",
  warning: "bg-amber-500",
  critical: "bg-red-500",
};

type UpcomingAlertsPanelProps = Readonly<{
  alerts: DashboardAlertRow[];
}>;

export function UpcomingAlertsPanel({ alerts }: UpcomingAlertsPanelProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-900">Upcoming alerts</h2>
        <p className="mt-0.5 text-sm text-slate-500">Pending scheduled reminders from your portfolio.</p>
      </div>
      {alerts.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-slate-600">No pending alerts. They appear after structured analysis schedules reminders.</p>
      ) : (
        <ul className="divide-y divide-slate-100 p-2">
          {alerts.map((alert) => (
            <li key={alert.id}>
              <div className="flex gap-3 rounded-lg px-3 py-3 transition hover:bg-slate-50">
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${severityDot[alert.severity]}`}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-snug text-slate-900">{alert.title}</p>
                  <p className="mt-1 text-xs font-medium text-slate-500">{alert.dueLabel}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
