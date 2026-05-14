import { WorkspaceExportsCard } from "@/components/dashboard/dashboard-exports";

export default function ExportPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Export data</h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
          Pull structured portfolio reports from your workspace. These exports reflect the same data you see on the
          dashboard and lease detail pages—useful for reporting, audits, and sharing with advisers.
        </p>
      </div>

      <WorkspaceExportsCard />
    </div>
  );
}
