const LEASE_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Object path in the `leases` bucket: `{userId}/{leaseId}.pdf`
 */
export function leasePdfStoragePath(userId: string, leaseId: string): string {
  return `${userId}/${leaseId}.pdf`;
}

export function isValidLeasePdfStoragePath(userId: string, leaseId: string, storagePath: string): boolean {
  const segments = storagePath.split("/").filter(Boolean);
  if (segments.length !== 2) {
    return false;
  }
  if (segments[0] !== userId) {
    return false;
  }
  if (!LEASE_ID.test(leaseId)) {
    return false;
  }
  return segments[1] === `${leaseId}.pdf`;
}
