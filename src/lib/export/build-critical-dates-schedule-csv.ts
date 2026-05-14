import { csvRow, withUtf8Bom } from "@/lib/export/csv-escape";
import type { LeaseWithExtractedForExport } from "@/lib/export/fetch-leases-for-export";
import {
  calendarDaysRemaining,
  computeAllLeaseActionsInPriorityOrder,
  LEASE_NEXT_ACTION_LABEL,
  urgencyFromDays,
} from "@/lib/lease/compute-lease-next-action";
import { extractedRowToNextActionInput } from "@/lib/lease/effective-lease-next-action";
import { parseIsoDateUtc } from "@/lib/alerts/date-helpers";
import { leaseTermStatusFromExpiryDate } from "@/lib/lease/lease-term-status";
import type { Tables } from "@/lib/supabase/database.types";

function normalizedExtracted(row: LeaseWithExtractedForExport): Tables<"extracted_data"> | null {
  const ed = row.extracted_data;
  if (!ed) {
    return null;
  }
  return Array.isArray(ed) ? ed[0] ?? null : ed;
}

function validCalendarIso(iso: string | null | undefined): iso is string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return false;
  }
  return parseIsoDateUtc(iso) !== null;
}

type ScheduleCsvRow = Readonly<{
  sortKey: string;
  leaseId: string;
  propertyName: string;
  termStatus: string;
  eventType: string;
  eventDate: string;
  daysRemaining: string;
  urgency: string;
  overallRisk: string;
  extractionStatus: string;
}>;

export function buildCriticalDatesScheduleCsv(leaseRows: LeaseWithExtractedForExport[]): string {
  const flat: ScheduleCsvRow[] = [];

  for (const leaseRow of leaseRows) {
    const ex = normalizedExtracted(leaseRow);
    const term = leaseTermStatusFromExpiryDate(ex?.expiry_date ?? null);
    const risk = leaseRow.overall_risk;
    const extraction = leaseRow.extraction_status;

    if (ex && validCalendarIso(ex.commencement_date)) {
      const iso = ex.commencement_date;
      const days = calendarDaysRemaining(iso);
      flat.push({
        sortKey: iso,
        leaseId: leaseRow.id,
        propertyName: leaseRow.property_name,
        termStatus: term,
        eventType: "Commencement",
        eventDate: iso,
        daysRemaining: days === null ? "" : String(days),
        urgency: days === null ? "" : urgencyFromDays(days),
        overallRisk: risk,
        extractionStatus: extraction,
      });
    }

    if (ex) {
      const actions = computeAllLeaseActionsInPriorityOrder(extractedRowToNextActionInput(ex));
      for (const a of actions) {
        const sortKey = a.action_date ?? "9999-12-31";
        flat.push({
          sortKey,
          leaseId: leaseRow.id,
          propertyName: leaseRow.property_name,
          termStatus: term,
          eventType: LEASE_NEXT_ACTION_LABEL[a.action_type],
          eventDate: a.action_date ?? "",
          daysRemaining: a.days_remaining === null ? "" : String(a.days_remaining),
          urgency: a.urgency_level,
          overallRisk: risk,
          extractionStatus: extraction,
        });
      }
    }
  }

  flat.sort((a, b) => {
    const c = a.sortKey.localeCompare(b.sortKey);
    if (c !== 0) {
      return c;
    }
    return a.propertyName.localeCompare(b.propertyName, undefined, { sensitivity: "base" });
  });

  const header = csvRow([
    "lease_id",
    "property_name",
    "term_status",
    "event_type",
    "event_date",
    "days_remaining",
    "urgency",
    "overall_risk",
    "extraction_status",
  ]);

  let body = "";
  for (const r of flat) {
    body += csvRow([
      r.leaseId,
      r.propertyName,
      r.termStatus,
      r.eventType,
      r.eventDate,
      r.daysRemaining,
      r.urgency,
      r.overallRisk,
      r.extractionStatus,
    ]);
  }

  return withUtf8Bom(header + body);
}
