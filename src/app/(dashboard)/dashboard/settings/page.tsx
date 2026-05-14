import Link from "next/link";

import { Card } from "@/components/ui/card";

export const metadata = {
  title: "Settings · LeaseLens",
};

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-600">Workspace preferences for your LeaseLens account.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/dashboard/settings/notifications"
          className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow"
        >
          <h2 className="text-base font-semibold text-slate-900 group-hover:text-slate-950">Notifications</h2>
          <p className="mt-1 text-sm text-slate-600">
            Alert categories, reminder lead times before key dates, and digest email frequency.
          </p>
          <p className="mt-3 text-sm font-medium text-slate-700 underline-offset-2 group-hover:underline">Open</p>
        </Link>

        <Card
          title="More soon"
          description="Account details, data export defaults, and team access will appear here as the product grows."
        />
      </div>
    </div>
  );
}
