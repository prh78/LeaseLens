import { z } from "zod";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const dateOrNull = z.union([z.string().regex(ISO_DATE, "Expected YYYY-MM-DD"), z.null()]);

const dateArray = z.array(z.string().regex(ISO_DATE, "Expected YYYY-MM-DD"));

/**
 * Strict schema for OpenAI lease structured extraction.
 * All keys must be present in the model response (strict object).
 */
export const leaseAnalyseOutputSchema = z
  .object({
    commencement_date: dateOrNull,
    expiry_date: dateOrNull,
    break_dates: dateArray,
    notice_period_days: z.union([z.number().int().min(0).max(3650), z.null()]),
    rent_review_dates: dateArray,
    repairing_obligation: z.union([z.string(), z.null()]),
    service_charge_responsibility: z.union([z.string(), z.null()]),
    reinstatement_required: z.union([z.boolean(), z.null()]),
    vacant_possession_required: z.union([z.boolean(), z.null()]),
    conditional_break_clause: z.union([z.string(), z.null()]),
    ambiguous_language: z.boolean(),
    manual_review_recommended: z.boolean(),
    confidence_score: z.union([z.number().min(0).max(1), z.null()]),
    source_snippets: z.record(z.string(), z.string()),
  })
  .strict();

export type LeaseAnalyseOutput = z.infer<typeof leaseAnalyseOutputSchema>;

export function parseLeaseAnalyseJson(raw: unknown): LeaseAnalyseOutput {
  return leaseAnalyseOutputSchema.parse(raw);
}

export function safeParseLeaseAnalyseJson(raw: unknown) {
  return leaseAnalyseOutputSchema.safeParse(raw);
}
