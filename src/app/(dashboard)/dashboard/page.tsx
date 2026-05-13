import { LeasePortfolioTable } from "@/components/dashboard/lease-portfolio-table";
import { MetricStatCard } from "@/components/dashboard/metric-stat-card";
import { UpcomingAlertsPanel } from "@/components/dashboard/upcoming-alerts-panel";
import {
  dashboardMetrics,
  mockAlerts,
  mockLeases,
} from "@/lib/dashboard/mock-data";

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">
          Portfolio overview — mock data for layout preview.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-3">
        <MetricStatCard
          label="Total leases"
          value={dashboardMetrics.totalLeases}
          hint="Across all active properties"
        />
        <MetricStatCard
          label="Critical actions due"
          value={dashboardMetrics.criticalActionsDue}
          hint="Requires attention within 7 days"
          accent="danger"
        />
        <MetricStatCard
          label="High-risk leases"
          value={dashboardMetrics.highRiskLeases}
          hint="Elevated renewal or compliance risk"
          accent="warning"
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <LeasePortfolioTable leases={mockLeases} />
        </div>
        <div className="lg:col-span-1">
          <UpcomingAlertsPanel alerts={mockAlerts} />
        </div>
      </div>
    </div>
  );
}
