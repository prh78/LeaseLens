"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { AuthMessage } from "@/components/auth/auth-message";
import { createClient } from "@/lib/supabase/client";

function LoginFormFallback() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
      <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
      <div className="h-10 animate-pulse rounded-lg bg-slate-900/20" />
    </div>
  );
}

function LoginFormFields() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectedFrom = searchParams.get("redirectedFrom") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    router.replace(redirectedFrom);
    router.refresh();
  };

  return (
    <form onSubmit={handleLogin} className="space-y-4">
      {error ? <AuthMessage type="error" message={error} /> : null}

      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium text-slate-700">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-900"
          placeholder="you@company.com"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium text-slate-700">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-900"
          placeholder="Enter your password"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        {loading ? "Signing in..." : "Sign in"}
      </button>

      <div className="text-right">
        <Link href="/forgot-password" className="text-sm text-slate-600 hover:text-slate-900">
          Forgot password?
        </Link>
      </div>
    </form>
  );
}

export function LoginForm() {
  return (
    <Suspense fallback={<LoginFormFallback />}>
      <LoginFormFields />
    </Suspense>
  );
}
