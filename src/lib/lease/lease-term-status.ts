import { parseIsoDateUtc, startOfTodayUtc } from "@/lib/alerts/date-helpers";

export type LeaseTermStatus = "active" | "expired" | "unknown";

/**
 * Compares `expiry_date` (YYYY-MM-DD) to today's UTC calendar date.
 * Unknown when missing or not a valid ISO date string.
 */
export function leaseTermStatusFromExpiryDate(expiryDate: string | null | undefined): LeaseTermStatus {
  if (expiryDate == null || typeof expiryDate !== "string") {
    return "unknown";
  }
  const expiry = parseIsoDateUtc(expiryDate.trim());
  if (!expiry) {
    return "unknown";
  }
  const today = startOfTodayUtc();
  return today.getTime() > expiry.getTime() ? "expired" : "active";
}
