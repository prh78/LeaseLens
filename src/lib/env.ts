/**
 * Public Supabase env must use **static** `process.env.NEXT_PUBLIC_*` reads.
 * Next.js only inlines those at build time; dynamic keys like `process.env[key]`
 * stay empty in the browser bundle and cause "Missing ... NEXT_PUBLIC_SUPABASE_URL".
 */
export function getPublicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url?.trim()) {
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
