import Link from "next/link";
import { redirect } from "next/navigation";

import { NotificationSettingsForm } from "@/components/settings/notification-settings-form";
import { mergeNotificationSettingsFromRow } from "@/lib/notifications/notification-settings";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Notification settings · LeaseLens",
};

export default async function NotificationSettingsPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: row, error } = await supabase
    .from("user_notification_settings")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("notification settings load:", error.message);
  }

  const initial = mergeNotificationSettingsFromRow(row);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <p className="text-sm text-slate-500">
          <Link href="/dashboard/settings" className="font-medium text-slate-600 underline-offset-2 hover:underline">
            Settings
          </Link>{" "}
          <span className="text-slate-400">/</span> Notifications
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Notification settings</h1>
        <p className="mt-1 text-sm text-slate-600">
          Control how LeaseLens prepares lease alerts and how often you want portfolio digests.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <NotificationSettingsForm initial={initial} />
      </div>
    </div>
  );
}
