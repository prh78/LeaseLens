import type { LeaseDocumentType } from "@/lib/lease/lease-document-types";

export type LeaseDocumentSortRow = Readonly<{
  id: string;
  document_type: LeaseDocumentType;
  upload_date: string;
}>;

export function sortLeaseDocumentsForExtraction<T extends LeaseDocumentSortRow>(docs: readonly T[]): T[] {
  return [...docs].sort((a, b) => {
    const pa = a.document_type === "primary_lease" ? 0 : 1;
    const pb = b.document_type === "primary_lease" ? 0 : 1;
    if (pa !== pb) {
      return pa - pb;
    }
    const byDate = a.upload_date.localeCompare(b.upload_date);
    if (byDate !== 0) {
      return byDate;
    }
    return a.id.localeCompare(b.id);
  });
}
