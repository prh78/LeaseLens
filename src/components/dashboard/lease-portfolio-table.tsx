import type { MockLease } from "@/lib/dashboard/mock-data";

const riskStyles: Record<
  MockLease["riskLevel"],
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

const statusStyles: Record<MockLease["status"], string> = {
  active: "text-slate-700",
  renewal: "text-indigo-700",
  notice: "text-amber-800",
  closed: "text-slate-500",
};

const statusLabels: Record<MockLease["status"], string> = {
  active: "Active",
  renewal: "Renewal",
  notice: "Notice",
  closed: "Closed",
};

type LeasePortfolioTableProps = Readonly<{
  leases: MockLease[];
}>;

export function LeasePortfolioTable({ leases }: LeasePortfolioTableProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-900">Lease portfolio</h2>
        <p className="mt-0.5 text-sm text-slate-500">Placeholder data — connect Supabase when ready.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-5 py-3 font-medium">Property name</th>
              <th className="px-5 py-3 font-medium">Next action</th>
              <th className="px-5 py-3 font-medium">Days remaining</th>
              <th className="px-5 py-3 font-medium">Risk level</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leases.map((lease) => (
              <tr key={lease.id} className="transition hover:bg-slate-50/60">
                <td className="whitespace-nowrap px-5 py-3.5 font-medium text-slate-900">
                  {lease.propertyName}
                </td>
                <td className="max-w-[220px] px-5 py-3.5 text-slate-600">{lease.nextAction}</td>
                <td className="whitespace-nowrap px-5 py-3.5 tabular-nums text-slate-700">
                  {lease.daysRemaining}
                </td>
                <td className="whitespace-nowrap px-5 py-3.5">
                  <span
                    className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${riskStyles[lease.riskLevel].className}`}
                  >
                    {riskStyles[lease.riskLevel].label}
                  </span>
                </td>
                <td className={`whitespace-nowrap px-5 py-3.5 font-medium ${statusStyles[lease.status]}`}>
                  {statusLabels[lease.status]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
