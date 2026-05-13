"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { AuthMessage } from "@/components/auth/auth-message";
import { createClient } from "@/lib/supabase/client";

function AuthCallbackFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-100 to-white px-4 py-10">
      <p className="text-sm text-slate-600">Completing sign-in…</p>
    </main>
  );
}

function AuthCallbackFields() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const redirectTo = searchParams.get("redirectTo") ?? "/dashboard";
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const supabase = createClient();

      const url = new URL(window.location.href);
      const params = url.searchParams;
      const hashParams = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.hash);

      const accessToken = params.get("access_token") ?? hashParams.get("access_token");
      const refreshToken = params.get("refresh_token") ?? hashParams.get("refresh_token");
      const code = params.get("code") ?? hashParams.get("code");

      if (accessToken && refreshToken) {
        const { error: setSessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (setSessionError) {
          if (!mounted) return;
          setError(setSessionError.message);
          return;
        }
      } else if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          if (!mounted) return;
          setError(exchangeError.message);
          return;
        }
      }

      const { data, error: userError } = await supabase.auth.getUser();
      if (userError) {
        if (!mounted) return;
        setError(userError.message);
        return;
      }

      if (!data.user) {
        if (!mounted) return;
        setError("No active session found for this callback.");
        return;
      }

      if (!mounted) return;
      router.replace(redirectTo);
      router.refresh();
    })();

    return () => {
      mounted = false;
    };
  }, [redirectTo, router]);

  return error ? (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-100 to-white px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">Authentication issue</h1>
        <p className="mt-3 text-sm text-slate-600">LeaseLens couldn’t complete the sign-in flow.</p>
        <div className="mt-4">
          <AuthMessage type="error" message={error} />
        </div>
      </div>
    </main>
  ) : (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-100 to-white px-4 py-10">
      <p className="text-sm text-slate-600">Completing sign-in…</p>
    </main>
  );
}

export function AuthCallbackClient() {
  return (
    <Suspense fallback={<AuthCallbackFallback />}>
      <AuthCallbackFields />
    </Suspense>
  );
}
