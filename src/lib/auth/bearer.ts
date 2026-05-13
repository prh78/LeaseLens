export function parseBearerFromRequest(request: Request): string | null {
  const raw = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!raw) {
    return null;
  }
  const match = /^Bearer\s+(.+)$/i.exec(raw.trim());
  const token = match?.[1]?.trim();
  return token || null;
}
