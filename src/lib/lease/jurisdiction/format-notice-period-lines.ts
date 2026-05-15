import { formatAppDate } from "@/lib/lease/format-app-date";
import { effectiveNoticePeriodDays } from "@/lib/lease/jurisdiction/notice-period";
import { parseNoticePeriodSpec } from "@/lib/lease/jurisdiction/parse-notice-period-spec";
import type { NoticePeriodSpec } from "@/lib/lease/jurisdiction/types";
import type { Tables } from "@/lib/supabase/database.types";

function describeNoticeSpec(spec: NoticePeriodSpec): string {
  const unitLabel =
    spec.unit === "calendar_days"
      ? "calendar day"
      : spec.unit === "business_days"
        ? "business day"
        : spec.unit === "months"
          ? "month"
          : "year";
  const plural = spec.value === 1 ? unitLabel : `${unitLabel}s`;
  return `${spec.value} ${plural}`;
}

export function formatNoticePeriodLines(
  extracted: Tables<"extracted_data">,
  locale: string,
): string[] {
  const spec = parseNoticePeriodSpec(extracted.notice_period_spec);
  const resolved = effectiveNoticePeriodDays(extracted.notice_period_days, spec);

  if (resolved.days == null && !spec) {
    return ["—"];
  }

  const lines: string[] = [];

  if (resolved.days != null) {
    lines.push(`${resolved.days} calendar day${resolved.days === 1 ? "" : "s"}`);
  } else if (spec) {
    lines.push(describeNoticeSpec(spec));
  }

  if (spec?.source_text) {
    lines.push(`Lease wording: “${spec.source_text}”`);
  }

  if (!resolved.confident && spec) {
    lines.push(
      resolved.warning ??
        "Confirm the notice period manually before relying on break and expiry calculations.",
    );
  }

  return lines;
}

export function formatInternationalContextLines(
  extracted: Tables<"extracted_data">,
  leaseJurisdictionLabel: string,
): string[] {
  const lines: string[] = [];
  if (extracted.governing_law?.trim()) {
    lines.push(extracted.governing_law.trim());
  }
  if (extracted.premises_country) {
    lines.push(`Premises country: ${extracted.premises_country}`);
  }
  if (extracted.rent_currency) {
    lines.push(`Rent currency: ${extracted.rent_currency}`);
  }
  lines.push(`Region pack: ${leaseJurisdictionLabel}`);
  return lines.length > 0 ? lines : ["—"];
}
