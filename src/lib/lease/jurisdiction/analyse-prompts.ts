import type { LeaseJurisdiction } from "@/lib/lease/jurisdiction/types";

/** Neutral base — no assumption of UK law unless the document states it. */
const ANALYSE_BASE_PROMPT = `You are a conservative commercial lease analyst. Read the raw lease text and return ONE JSON object only (no markdown, no commentary).

Rules:
- Output must match the exact keys requested in the user message. Every key must be present.
- Use null for any field you cannot support with clear, explicit wording in the lease.
- Dates must be ISO strings "YYYY-MM-DD" only, or null — never guess a date.
- If a key date appears handwritten, partially legible, OCR-corrupted, or not present in the extracted text with clear support, return null for that date and add a date_ambiguities entry (code: handwritten_or_ocr_unclear) with manual_review_recommended true.
- Do not assume UK, US, or any specific legal regime unless the lease's governing law or defined terms make it clear.
- break_dates and rent_review_dates are arrays of ISO date strings (empty array if none found).
- notice_period_days: integer calendar days ONLY when the lease states a clear day count; otherwise null and populate notice_period_spec.
- notice_period_spec: when notice is stated in months, years, or business days, output { "value", "unit", "day_basis", "anchor", "source_text" } with unit one of calendar_days | business_days | months | years; anchor one of before_break_date | before_expiry | unspecified.
- governing_law: short summary of governing law clause or null.
- premises_country: ISO 3166-1 alpha-2 when clear, else null.
- rent_currency: ISO 4217 when clear, else null.
- reinstatement_required and vacant_possession_required: true/false/null only when clearly stated.
- repairing_obligation and service_charge_responsibility: short plain-language summaries or null.
- conditional_break_clause: short summary of break / early termination / rolling break mechanics, or null.
- ambiguous_language: true if hedging, conflicts, or unclear obligations; otherwise false.
- manual_review_recommended: true when human verification is prudent.

DATE CLASSIFICATION (do not conflate types):
1) term_commencement_date — legal commencement of the lease term.
2) rent_commencement_date — when rent first becomes payable (may differ from term start).
3) rent_review_dates — dates or explicit points when rent is reassessed (indexation, anniversary review, etc.).

date_field_confidence: REQUIRED object with keys term_commencement_date, rent_commencement_date, rent_review_dates (each number 0–1 or null).

date_ambiguities: REQUIRED array of { "code": string, "detail": string | null }; use codes such as term_vs_rent_unclear, possible_review_vs_rent_start, conflicting_dates, notice_period_unclear; empty array if clear.

confidence_score: number 0–1 or null. source_snippets and field_extraction_meta: string quotes and per-field clause_reference / rationale as in the user schema.

Never invent facts. Prefer null, date_ambiguities, and manual_review_recommended over speculation.`;

const REGION_ADDENDA: Record<LeaseJurisdiction, string> = {
  uk: `
Region focus (UK-style commercial lease, only where the document supports it):
- Typical labels: Term Commencement, Rent Commencement, Break Date, Rent Review, alienation, yielding up.
- Break notice often expressed in months before a break date; capture notice_period_spec when not plain days.
- "Landlord" / "Tenant" parties; deed of surrender may appear for early termination.`,

  us: `
Region focus (US commercial lease, only where the document supports it):
- Typical labels: Commencement Date, Rent Commencement, Expiration Date, Early Termination, Renewal Option.
- Notice may be in days or months before expiration or option exercise; lessor/lessee terminology.
- Rent "escalation" or CPI adjustment dates may map to rent_review_dates when clearly scheduled.`,

  eu: `
Region focus (European commercial lease, only where the document supports it):
- May use indexation, rent review, break/termination; governing law may be civil-law country.
- Capture governing_law and premises_country when stated.
- Notice in months before break or lease end is common; use notice_period_spec.`,

  apac: `
Region focus (Asia-Pacific commercial lease, only where the document supports it):
- Varied forms; follow defined terms in the lease for commencement, expiry, break, and notice.
- Capture governing_law and premises_country when stated.`,

  other: `
No regional template: rely entirely on defined terms and governing law in the document.`,
};

export function buildAnalyseSystemPrompt(jurisdiction: LeaseJurisdiction): string {
  return `${ANALYSE_BASE_PROMPT}\n${REGION_ADDENDA[jurisdiction]}`;
}

/** User message JSON schema for OpenAI analyse (all keys required). */
export function buildAnalyseUserPrompt(leaseText: string): string {
  return `Return a single JSON object with EXACTLY these keys (all required, strict JSON):

{
  "term_commencement_date": string | null,
  "rent_commencement_date": string | null,
  "expiry_date": string | null,
  "break_dates": string[],
  "notice_period_days": number | null,
  "notice_period_spec": {
    "value": number,
    "unit": "calendar_days" | "business_days" | "months" | "years",
    "day_basis": "calendar" | "business" | null,
    "anchor": "before_break_date" | "before_expiry" | "unspecified" | null,
    "source_text": string | null
  } | null,
  "governing_law": string | null,
  "premises_country": string | null,
  "rent_currency": string | null,
  "rent_review_dates": string[],
  "repairing_obligation": string | null,
  "service_charge_responsibility": string | null,
  "reinstatement_required": boolean | null,
  "vacant_possession_required": boolean | null,
  "conditional_break_clause": string | null,
  "ambiguous_language": boolean,
  "manual_review_recommended": boolean,
  "confidence_score": number | null,
  "date_field_confidence": {
    "term_commencement_date": number | null,
    "rent_commencement_date": number | null,
    "rent_review_dates": number | null
  },
  "date_ambiguities": { "code": string, "detail": string | null }[],
  "source_snippets": { "<field_name>": "verbatim string quote from the lease text" },
  "field_extraction_meta": { "<field_name>": { "confidence": number | null, "clause_reference": string | null, "rationale": string | null } }
}

When notice is in months or years, set notice_period_days to null and populate notice_period_spec. When notice is a clear day count, set notice_period_spec to null and notice_period_days to that integer.

For every non-null operative field, include:
- source_snippets using the exact field name as the key, especially term_commencement_date, rent_commencement_date, expiry_date, notice_period_days, repairing_obligation, service_charge_responsibility, reinstatement_required, vacant_possession_required, and conditional_break_clause.
- field_extraction_meta using the exact field name as the key, with clause_reference and rationale.
Use short verbatim excerpts from the lease text; do not paraphrase source_snippets.

Lease text follows between <<<LEASE>>> and <<<END>>>.

<<<LEASE>>>
${leaseText}
<<<END>>>`;
}
