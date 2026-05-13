import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/upload/:path*",
    "/lease/:path*",
    "/api/analyse",
    "/api/extract",
    "/login",
    "/signup",
    "/forgot-password",
    "/auth/callback/:path*",
    "/auth/callback",
    "/auth/update-password",
  ],
};
