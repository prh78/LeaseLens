import Link from "next/link";

import { SignOutButton } from "@/components/auth/sign-out-button";

type DashboardTopNavProps = Readonly<{
  userEmail?: string | null;
}>;

export function DashboardTopNav({ userEmail }: DashboardTopNavProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-8">
          <Link href="/dashboard" className="flex shrink-0 items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-xs font-bold text-white">
              LL
            </span>
            <span className="hidden text-sm font-semibold tracking-tight text-slate-900 sm:inline">
              LeaseLens
            </span>
          </Link>
          <div className="hidden max-w-md flex-1 md:block">
            <label htmlFor="dashboard-search" className="sr-only">
              Search portfolio
            </label>
            <input
              id="dashboard-search"
              type="search"
              placeholder="Search properties, leases, documents…"
              disabled
              className="w-full rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm text-slate-500 placeholder:text-slate-400"
              title="Search coming soon"
            />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {userEmail ? (
            <span className="hidden max-w-[200px] truncate text-right text-xs text-slate-500 sm:block">
              {userEmail}
            </span>
          ) : null}
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
