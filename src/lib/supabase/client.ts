import { createBrowserClient } from "@supabase/ssr";

import { getPublicEnv } from "@/lib/env";

/**
 * Browser Supabase client (SSR-aware cookie session).
 * Use `Tables`, `TablesInsert` from `@/lib/supabase/database.types` with `queries.ts` helpers.
 */
export function createClient() {
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = getPublicEnv();

  return createBrowserClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export type LeaseLensBrowserClient = ReturnType<typeof createClient>;
