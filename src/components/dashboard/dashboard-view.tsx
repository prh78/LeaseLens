import Link from "next/link";

import { DashboardEmptyOnboarding } from "@/components/dashboard/dashboard-empty-onboarding";
import { DashboardExports } from "@/components/dashboard/dashboard-exports";
import { DashboardProcessingRefresh } from "@/components/dashboard/dashboard-processing-refresh";
import { DashboardReviewQueue } from "@/components/dashboard/dashboard-review-queue";
import { LeasePortfolioTable } from "@/components/dashboard/lease-portfolio-table";
import { MetricStatCard } from "@/components/dashboard/metric-stat-card";
import { DashboardLeasePipeline } from "@/components/leases/dashboard-lease-pipeline";
import type { DashboardData } from "@/lib/dashboard/types";

type DashboardViewProps = Readonly<{
  data: DashboardData;
  pipelineLeaseIds: string[];
  hasProcessingLeases: boolean;
}>;

export function DashboardView({ data, pipelineLeaseIds, hasProcessingLeases }: DashboardViewProps) {
  const { metrics, leases } = data;
  const hasLeases = leases.length > 0;

  return (
    <div className="space-y-8">
      <DashboardProcessingRefresh enabled={hasProcessingLeases} />
      <DashboardLeasePipeline pipelineLeaseIds={pipelineLeaseIds} />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">
          {hasLeases ? "Portfolio overview from your Supabase data." : "Welcome—add a lease to unlock your portfolio."}
        </p>
      </div>

      {!hasLeases ? (
        <DashboardEmptyOnboarding />
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricStatCard
              label="Total leases"
              value={metrics.totalLeases}
              hint="Across all properties in your workspace"
            />
            <MetricStatCard
              label="Critical actions due"
              value={metrics.criticalActionsDue}
              hint="Leases with high/critical urgency or a dated action within 90 days (or manual review)"
              accent="danger"
            />
            <MetricStatCard
              label="High-risk leases"
              value={metrics.highRiskLeases}
              hint="Overall risk marked high"
              accent="warning"
            />
            <MetricStatCard
              label="Pending reviews"
              value={metrics.pendingReviews}
              hint="Leases flagged after extraction and awaiting verification"
              accent={metrics.pendingReviews > 0 ? "warning" : "default"}
            />
          </section>

          <DashboardReviewQueue items={data.reviewQueue} />

          <DashboardExports />

          <LeasePortfolioTable leases={leases} />

          <p className="text-center text-xs text-slate-400">
            Need another document?{" "}
            <Link href="/upload" className="font-medium text-slate-600 underline underline-offset-2 hover:text-slate-900">
              Upload a lease
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
