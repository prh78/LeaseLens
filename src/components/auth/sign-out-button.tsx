"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

type SignOutButtonProps = Readonly<{
  className?: string;
}>;

export function SignOutButton({ className }: SignOutButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSignOut = async () => {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  const base =
    "rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <button type="button" onClick={handleSignOut} disabled={loading} className={className ? `${base} ${className}` : base}>
      {loading ? "Signing out…" : "Sign out"}
    </button>
  );
}
