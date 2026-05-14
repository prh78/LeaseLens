import type { LeaseDocumentProcessingStatus, LeaseDocumentType } from "@/lib/supabase/database.types";

export type { LeaseDocumentProcessingStatus, LeaseDocumentType } from "@/lib/supabase/database.types";

export const LEASE_DOCUMENT_TYPES: readonly LeaseDocumentType[] = [
  "primary_lease",
  "deed_of_variation",
  "lease_extension",
  "side_letter",
  "licence_to_alter",
  "rent_review_memorandum",
  "assignment",
] as const;

export const LEASE_DOCUMENT_TYPE_LABEL: Record<LeaseDocumentType, string> = {
  primary_lease: "Primary Lease",
  deed_of_variation: "Deed of Variation",
  lease_extension: "Lease Extension",
  side_letter: "Side Letter",
  licence_to_alter: "Licence to Alter",
  rent_review_memorandum: "Rent Review Memorandum",
  assignment: "Assignment",
};

export const LEASE_DOCUMENT_PROCESSING_STATUSES: readonly LeaseDocumentProcessingStatus[] = [
  "pending",
  "uploading",
  "extracting_text",
  "analysing",
  "complete",
  "failed",
] as const;

export function isLeaseDocumentType(value: string): value is LeaseDocumentType {
  return (LEASE_DOCUMENT_TYPES as readonly string[]).includes(value);
}
