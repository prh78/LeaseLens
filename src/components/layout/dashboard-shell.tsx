import { SidebarNav } from "@/components/layout/sidebar-nav";

type DashboardShellProps = Readonly<{
  children: React.ReactNode;
}>;

export function DashboardShell({ children }: DashboardShellProps) {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 p-4 md:grid-cols-[220px_1fr] md:p-6">
        <aside className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
            LeaseLens
          </p>
          <SidebarNav />
        </aside>
        <main className="space-y-4">{children}</main>
      </div>
    </div>
  );
}
