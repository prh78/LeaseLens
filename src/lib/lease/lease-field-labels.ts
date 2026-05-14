/** UI labels for structured / provenance keys */
export const OPERATIVE_FIELD_LABELS: Record<string, string> = {
  commencement_date: "Commencement date",
  expiry_date: "Expiry date",
  break_dates: "Break date(s)",
  notice_period_days: "Notice period",
  rent_review_dates: "Rent review dates",
  repairing_obligation: "Repairing obligation",
  reinstatement_required: "Reinstatement clause",
  service_charge_responsibility: "Service charge responsibility",
  vacant_possession_required: "Vacant possession requirement",
  conditional_break_clause: "Conditional break",
  ambiguous_language: "Ambiguous language",
  manual_review_recommended: "Manual review recommended",
  confidence_score: "Confidence score",
  source_snippets: "Source snippets",
};

export function operativeFieldLabel(key: string): string {
  return OPERATIVE_FIELD_LABELS[key] ?? key.replace(/_/g, " ");
}
