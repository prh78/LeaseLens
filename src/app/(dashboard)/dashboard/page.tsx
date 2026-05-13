import { DashboardView } from "@/components/dashboard/dashboard-view";
import { fetchDashboardData } from "@/lib/dashboard/fetch-dashboard-data";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated.");
  }

  const data = await fetchDashboardData(supabase, user.id);

  return <DashboardView data={data} />;
}
