import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/upload/:path*",
    "/export",
    "/export/:path*",
    "/lease/:path*",
    "/api/analyse",
    "/api/extract",
    "/api/leases/:path*",
    "/api/export",
    "/api/export/:path*",
    "/api/v1/leases",
    "/api/v1/leases/:path*",
    "/login",
    "/signup",
    "/forgot-password",
    "/auth/callback/:path*",
    "/auth/callback",
    "/auth/update-password",
  ],
};
