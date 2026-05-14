import { DashboardPortfolioFiltersProvider } from "@/components/dashboard/dashboard-portfolio-filters-context";
import { DashboardTopNav } from "@/components/layout/dashboard-top-nav";
import { SidebarNav } from "@/components/layout/sidebar-nav";

type DashboardShellProps = Readonly<{
  children: React.ReactNode;
  userEmail?: string | null;
}>;

export function DashboardShell({ children, userEmail }: DashboardShellProps) {
  return (
    <DashboardPortfolioFiltersProvider>
      <div className="flex min-h-screen flex-col bg-slate-100/80">
        <DashboardTopNav userEmail={userEmail} />
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="hidden w-56 shrink-0 border-r border-slate-200/80 bg-white lg:block">
          <div className="sticky top-14 flex max-h-[calc(100vh-3.5rem)] flex-col gap-4 overflow-y-auto p-4">
            <SidebarNav variant="sidebar" />
            <p className="mt-auto border-t border-slate-100 pt-4 text-[11px] leading-relaxed text-slate-400">
              LeaseLens · Portfolio intelligence
            </p>
          </div>
        </aside>
        <div className="border-b border-slate-200 bg-white px-4 py-2 lg:hidden">
          <SidebarNav variant="rail" />
        </div>
        <main className="min-h-0 min-w-0 flex-1 overflow-auto">
          <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
        </main>
        </div>
      </div>
    </DashboardPortfolioFiltersProvider>
  );
}
