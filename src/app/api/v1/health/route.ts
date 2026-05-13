import { ok } from "@/lib/api/route-handler";

export async function GET() {
  return ok({
    service: "LeaseLens API",
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "v1",
  });
}
