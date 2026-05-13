/**
 * Public Supabase env must use **static** `process.env.NEXT_PUBLIC_*` reads.
 * Next.js only inlines those at build time; dynamic keys like `process.env[key]`
 * stay empty in the browser bundle and cause "Missing ... NEXT_PUBLIC_SUPABASE_URL".
 */

/** Decode JWT payload without verifying signature (enough to detect service_role misuse). */
function readJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const json = atob(padded);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function assertBrowserSafeSupabaseKey(key: string) {
  const trimmed = key.trim();
  if (!trimmed.startsWith("eyJ")) {
    // e.g. sb_publishable_… — not a legacy JWT; skip role inspection.
    return;
  }
  const payload = readJwtPayload(trimmed);
  if (payload?.role === "service_role") {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY is set to the service_role secret JWT. That key must never run in the browser. " +
        "In Supabase: Project Settings → API → copy the anon public key (role is anon), not service_role. " +
        "On Vercel: if you also set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, remove or fix NEXT_PUBLIC_SUPABASE_ANON_KEY — " +
        "the anon variable wins when both are set.",
    );
  }
}

export function getPublicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) {
    throw new Error("Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL");
  }

  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!anonKey) {
    throw new Error(
      "Missing required environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)",
    );
  }

  assertBrowserSafeSupabaseKey(anonKey);

  return {
    NEXT_PUBLIC_SUPABASE_URL: url,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
  };
}

export function getServerEnv() {
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceRole) {
    throw new Error("Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY");
  }

  return {
    ...getPublicEnv(),
    SUPABASE_SERVICE_ROLE_KEY: serviceRole,
  };
}
