import {
  formatBreakAvailableFromLabel,
  type LeaseNextActionResult,
} from "@/lib/lease/compute-lease-next-action";

/** Human-readable relative / absolute timing for a next-action row. */
export function formatNextActionDueLabel(next: LeaseNextActionResult): string {
  if (next.action_type === "manual_review") {
    return "Review recommended";
  }
  if (next.break_clause_tier === "decision_reminder" && next.break_available_from) {
    return formatBreakAvailableFromLabel(next.break_available_from);
  }
  if (next.break_clause_tier === "intend_projected_end") {
    if (next.days_remaining === null || !next.action_date) {
      return "If notice served today";
    }
    if (next.days_remaining <= 0) {
      return "Ends today if notice served today";
    }
    if (next.days_remaining === 1) {
      return "Ends in 1 day if notice served today";
    }
    if (next.days_remaining < 14) {
      return `Ends in ${next.days_remaining} days if notice served today`;
    }
    const d = new Date(`${next.action_date}T12:00:00.000Z`);
    if (Number.isNaN(d.getTime())) {
      return `Ends ${next.action_date} if notice served today`;
    }
    const label = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    return `Ends ${label} if notice served today`;
  }
  if (next.days_remaining === null || !next.action_date) {
    return "—";
  }
  if (next.days_remaining <= 0) {
    return "Due now";
  }
  if (next.days_remaining === 1) {
    return "In 1 day";
  }
  if (next.days_remaining < 14) {
    return `In ${next.days_remaining} days`;
  }
  const d = new Date(`${next.action_date}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    return next.action_date;
  }
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
