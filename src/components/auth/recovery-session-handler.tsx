"use client";

import { useEffect, useState } from "react";

import { AuthMessage } from "@/components/auth/auth-message";
import { createClient } from "@/lib/supabase/client";

export function RecoverySessionHandler({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const supabase = createClient();
      const url = new URL(window.location.href);
      const searchParams = url.searchParams;

      // Some Supabase flows return tokens in the hash fragment.
      // Example: #access_token=...&refresh_token=...
      const hashParams = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.hash);

      const accessToken = searchParams.get("access_token") ?? hashParams.get("access_token");
      const refreshToken = searchParams.get("refresh_token") ?? hashParams.get("refresh_token");
      const code = searchParams.get("code") ?? hashParams.get("code");

      if (!mounted) return;

      if (accessToken && refreshToken) {
        const { error: setError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (setError) {
          setHasSession(false);
          setLoading(false);
          return;
        }
      } else if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          setHasSession(false);
          setLoading(false);
          return;
        }
      }

      // Ensure we end with a loaded session (or none).
      const { data, error: getUserError } = await supabase.auth.getUser();
      if (getUserError) {
        setHasSession(false);
        setLoading(false);
        return;
      }

      setHasSession(!!data.user);
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return <p className="text-sm text-slate-600">Checking reset link...</p>;
  }

  if (hasSession === false) {
    return (
      <AuthMessage
        type="error"
        message="Your reset link is invalid or expired. Request a new password reset."
      />
    );
  }

  return <>{children}</>;
}

