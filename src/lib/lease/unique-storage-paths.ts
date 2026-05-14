/** Deduplicated non-empty object paths for the `leases` storage bucket. */
export function uniqueStoragePaths(paths: readonly (string | null | undefined)[]): string[] {
  const out = new Set<string>();
  for (const p of paths) {
    if (typeof p !== "string") {
      continue;
    }
    const t = p.trim();
    if (t.length > 0) {
      out.add(t);
    }
  }
  return [...out];
}
