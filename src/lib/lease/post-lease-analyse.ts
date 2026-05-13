export type PostLeaseAnalyseResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

/**
 * Calls `POST /api/analyse` with the current user's session token.
 */
export async function postLeaseAnalyse(accessToken: string, leaseId: string): Promise<PostLeaseAnalyseResult> {
  const res = await fetch("/api/analyse", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ leaseId }),
  });

  let message = `Request failed (${res.status}).`;
  try {
    const body = (await res.json()) as { error?: string };
    if (typeof body.error === "string" && body.error.trim()) {
      message = body.error.trim();
    }
  } catch {
    /* ignore */
  }

  if (!res.ok) {
    return { ok: false, status: res.status, error: message };
  }

  return { ok: true };
}
