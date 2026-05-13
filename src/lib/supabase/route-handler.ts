import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getPublicEnv } from "@/lib/env";

function parseBearerFromRequest(request: Request): string | null {
  const raw = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!raw) {
    return null;
  }
  const match = /^Bearer\s+(.+)$/i.exec(raw.trim());
  const token = match?.[1]?.trim();
  return token || null;
}

/**
 * Supabase client for Route Handlers: reads the session from cookies and, when the
 * client sends `Authorization: Bearer <access_token>`, merges that JWT into
 * `global.headers` so PostgREST requests run as the signed-in user.
 *
 * Cookie-only sessions are unreliable in some App Router route handler contexts;
 * forwarding the access token fixes `leases` (and other) RLS inserts.
 */
export async function createRouteHandlerSupabaseClient(request: Request) {
  const cookieStore = await cookies();
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = getPublicEnv();
  const accessToken = parseBearerFromRequest(request);

  return createServerClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      },
    },
    global: accessToken
      ? {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      : {},
  });
}
