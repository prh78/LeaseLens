"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { DashboardHeaderPortfolioSearch } from "@/components/layout/dashboard-header-portfolio-search";

type DashboardTopNavProps = Readonly<{
  userEmail?: string | null;
}>;

export function DashboardTopNav({ userEmail }: DashboardTopNavProps) {
  const pathname = usePathname();
  const showPortfolioSearch = pathname === "/dashboard";

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between gap-3 px-4 sm:gap-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-5">
          <Link href="/dashboard" className="flex shrink-0 items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-xs font-bold text-white">
              LL
            </span>
            <span className="hidden text-sm font-semibold tracking-tight text-slate-900 sm:inline">LeaseLens</span>
          </Link>
          {showPortfolioSearch ? <DashboardHeaderPortfolioSearch /> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
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
