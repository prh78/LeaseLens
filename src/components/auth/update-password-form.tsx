"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { AuthMessage } from "@/components/auth/auth-message";
import { createClient } from "@/lib/supabase/client";

export function UpdatePasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpdatePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  };

  return (
    <form onSubmit={handleUpdatePassword} className="space-y-4">
      {error ? <AuthMessage type="error" message={error} /> : null}

      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium text-slate-700">
          New password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-900"
          placeholder="At least 8 characters"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        {loading ? "Updating..." : "Update password"}
      </button>
    </form>
  );
}
