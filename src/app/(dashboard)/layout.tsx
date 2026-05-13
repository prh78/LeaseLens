import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type DashboardGroupLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default async function DashboardGroupLayout({ children }: DashboardGroupLayoutProps) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <DashboardShell userEmail={user.email}>{children}</DashboardShell>;
}
