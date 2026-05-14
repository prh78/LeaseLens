import { DashboardView } from "@/components/dashboard/dashboard-view";
import { fetchDashboardData } from "@/lib/dashboard/fetch-dashboard-data";
import { isExtractionProcessing } from "@/lib/lease/extraction-pipeline";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated.");
  }

  const data = await fetchDashboardData(supabase, user.id);

  const pipelineLeaseIds = data.leases
    .filter((l) => l.extractionStatus === "uploading" || l.extractionStatus === "extracting" || l.extractionStatus === "analysing")
    .map((l) => l.id);

  const hasProcessingLeases = data.leases.some((l) => isExtractionProcessing(l.extractionStatus));

  return (
    <DashboardView data={data} pipelineLeaseIds={pipelineLeaseIds} hasProcessingLeases={hasProcessingLeases} />
  );
}
