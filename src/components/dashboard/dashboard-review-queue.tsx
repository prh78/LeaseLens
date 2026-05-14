import Link from "next/link";

import type { DashboardReviewQueueItem } from "@/lib/dashboard/types";
import { humanizeKey } from "@/lib/lease/lease-detail";
import type { LeaseReviewPriority } from "@/lib/supabase/database.types";

const priorityStyles: Record<
  LeaseReviewPriority,
  { label: string; className: string }
> = {
  high: { label: "High", className: "bg-red-50 text-red-950 ring-1 ring-inset ring-red-200/80" },
  medium: { label: "Medium", className: "bg-amber-50 text-amber-950 ring-1 ring-inset ring-amber-200/80" },
  low: { label: "Low", className: "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200" },
};

function formatAffectedFields(fields: readonly string[]): string {
  if (fields.length === 0) {
    return "—";
  }
  const shown = fields.slice(0, 8).map((f) => humanizeKey(f));
  const suffix = fields.length > 8 ? ` (+${fields.length - 8} more)` : "";
  return `${shown.join(", ")}${suffix}`;
}

type DashboardReviewQueueProps = Readonly<{
  items: readonly DashboardReviewQueueItem[];
}>;

export function DashboardReviewQueue({ items }: DashboardReviewQueueProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-900">Review queue</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Leases flagged for human verification after structured extraction. Open a lease to mark it verified or
          unresolved.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-5 py-3 font-medium">Lease</th>
              <th className="px-5 py-3 font-medium">Affected fields</th>
              <th className="px-5 py-3 font-medium">Review reason</th>
              <th className="px-5 py-3 font-medium">Priority</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item) => {
              const href = `/lease/${item.leaseId}`;
              const pr = priorityStyles[item.priority];
              return (
                <tr key={item.leaseId} className="transition hover:bg-slate-50/60">
                  <td className="px-5 py-3.5 font-medium text-slate-900">
                    <Link
                      href={href}
                      className="text-slate-900 underline decoration-slate-300 underline-offset-2 hover:text-slate-700"
                    >
                      {item.propertyName}
                    </Link>
                  </td>
                  <td className="max-w-md px-5 py-3.5 text-slate-700">{formatAffectedFields(item.affectedFields)}</td>
                  <td className="max-w-xl px-5 py-3.5 text-slate-600">{item.reason?.trim() || "—"}</td>
                  <td className="whitespace-nowrap px-5 py-3.5">
                    <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${pr.className}`}>
                      {pr.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
