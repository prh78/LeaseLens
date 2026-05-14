const LEASE_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DOCUMENT_ID = LEASE_ID;

/**
 * Object path in the `leases` bucket: `{userId}/{leaseId}.pdf`
 * @deprecated Prefer {@link leaseDocumentPdfStoragePath} for new uploads.
 */
export function leasePdfStoragePath(userId: string, leaseId: string): string {
  return `${userId}/${leaseId}.pdf`;
}

/**
 * Object path in the `leases` bucket: `{userId}/{leaseId}/{documentId}.pdf`
 */
export function leaseDocumentPdfStoragePath(userId: string, leaseId: string, documentId: string): string {
  return `${userId}/${leaseId}/${documentId}.pdf`;
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

export function isValidLeaseDocumentPdfStoragePath(
  userId: string,
  leaseId: string,
  documentId: string,
  storagePath: string,
): boolean {
  const segments = storagePath.split("/").filter(Boolean);
  if (segments.length !== 3) {
    return false;
  }
  if (segments[0] !== userId) {
    return false;
  }
  if (!LEASE_ID.test(leaseId) || !DOCUMENT_ID.test(documentId)) {
    return false;
  }
  if (segments[1] !== leaseId) {
    return false;
  }
  return segments[2] === `${documentId}.pdf`;
}

/** Legacy `{user}/{lease}.pdf` or per-document `{user}/{lease}/{documentId}.pdf`. */
export function isValidUserLeaseStorageObjectPath(userId: string, leaseId: string, storagePath: string): boolean {
  if (isValidLeasePdfStoragePath(userId, leaseId, storagePath)) {
    return true;
  }
  const segments = storagePath.split("/").filter(Boolean);
  if (segments.length !== 3 || segments[0] !== userId || segments[1] !== leaseId || !LEASE_ID.test(leaseId)) {
    return false;
  }
  const file = segments[2];
  if (!file.endsWith(".pdf")) {
    return false;
  }
  const documentId = file.slice(0, -".pdf".length);
  return isValidLeaseDocumentPdfStoragePath(userId, leaseId, documentId, storagePath);
}
