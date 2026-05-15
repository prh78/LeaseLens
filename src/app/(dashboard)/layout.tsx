import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { fetchDisplayLocaleForUser } from "@/lib/user/fetch-display-locale";
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

  const displayLocale = await fetchDisplayLocaleForUser(supabase, user.id);

  return (
    <DashboardShell userEmail={user.email} displayLocale={displayLocale}>
      {children}
    </DashboardShell>
  );
}
