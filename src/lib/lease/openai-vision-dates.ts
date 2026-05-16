import { z } from "zod";

import type { RenderedPdfPageImage } from "@/lib/pdf/render-pages";

export type VisionKeyDateField = "term_commencement_date" | "rent_commencement_date" | "expiry_date" | "break_dates";

export type VisionDateCandidate = Readonly<{
  field: VisionKeyDateField;
  value: string | string[] | null;
  confidence: number | null;
  pageNumber: number | null;
  sourceText: string | null;
  rationale: string | null;
}>;

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_VISION_MODEL = "gpt-4o";
const DEFAULT_TIMEOUT_MS = 180_000;

const candidateSchema = z.object({
  field: z.enum(["term_commencement_date", "rent_commencement_date", "expiry_date", "break_dates"]),
  value: z.union([z.string().regex(ISO), z.array(z.string().regex(ISO)), z.null()]),
  confidence: z.union([z.number().min(0).max(1), z.null()]),
  pageNumber: z.union([z.number().int().min(1), z.null()]),
  sourceText: z.union([z.string().max(1000), z.null()]),
  rationale: z.union([z.string().max(1000), z.null()]),
});

const responseSchema = z.object({
  candidates: z.array(candidateSchema),
});

function openAiVisionTimeoutMs(): number {
  const raw = process.env.OPENAI_VISION_TIMEOUT_MS?.trim();
  if (!raw) {
    return DEFAULT_TIMEOUT_MS;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? Math.min(Math.max(Math.floor(n), 15_000), 600_000) : DEFAULT_TIMEOUT_MS;
}

function stripMarkdownJsonFence(content: string): string {
  const trimmed = content.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/im.exec(trimmed);
  return fence?.[1]?.trim() ?? trimmed;
}

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
  error?: { message?: string };
};

function fieldInstruction(fields: readonly VisionKeyDateField[]): string {
  const labels: Record<VisionKeyDateField, string> = {
    term_commencement_date: "legal commencement date of the lease term",
    rent_commencement_date: "date rent first becomes payable, not rent review/escalation dates",
    expiry_date: "contractual expiry / expiration / end date of the lease term",
    break_dates: "break date(s), termination option date(s), or early termination option date(s)",
  };
  return fields.map((field) => `- ${field}: ${labels[field]}`).join("\n");
}

export async function readKeyDatesWithOpenAIVision(input: Readonly<{
  pageImages: readonly RenderedPdfPageImage[];
  fields: readonly VisionKeyDateField[];
}>): Promise<VisionDateCandidate[]> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey || input.pageImages.length === 0 || input.fields.length === 0) {
    return [];
  }

  const model = process.env.OPENAI_VISION_MODEL?.trim() || DEFAULT_VISION_MODEL;
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), openAiVisionTimeoutMs());

  const prompt = `You are reading rendered images of a commercial lease.

Task: extract ONLY these key dates if they are clearly legible, including handwritten dates:
${fieldInstruction(input.fields)}

Rules:
- Return null for a field unless the date is clearly tied to its label/definition.
- break_dates must be an array of ISO dates when one or more break/termination option dates are clearly tied to a break option label; otherwise null.
- Do not use rent review, rent escalation, signature, completion, handwritten completion, or document dates as key dates or break_dates.
- The lease may have handwritten dates in boxes or blanks beside printed labels. If a handwritten date is legible and tied to the label, return it.
- Pay particular attention to printed labels such as "Term Commencement Date", "Rent Commencement Date", "Expiry Date", "Break Date", "Option Date", "Termination Date".
- Inspect every supplied page image. Page labels are provided immediately before each image.
- sourceText should quote/transcribe the nearby label and handwritten/printed date exactly enough for audit; if handwriting cannot be quoted exactly, describe the label and handwritten date read.
- Use ISO YYYY-MM-DD for value.
- Return strict JSON only:
{ "candidates": [{ "field": "...", "value": "YYYY-MM-DD" | null, "confidence": 0-1 | null, "pageNumber": number | null, "sourceText": string | null, "rationale": string | null }] }`;

  try {
    const content = [
      { type: "text", text: prompt },
      ...input.pageImages.flatMap((image) => [
        {
          type: "text",
          text: `PAGE ${image.pageNumber}`,
        },
        {
          type: "image_url",
          image_url: {
            url: image.dataUrl,
            detail: "high",
          },
        },
      ]),
    ];

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content }],
      }),
    });

    const payload = (await res.json()) as ChatCompletionResponse;
    if (!res.ok) {
      throw new Error(payload.error?.message ?? `OpenAI vision HTTP ${res.status}`);
    }

    const body = payload.choices?.[0]?.message?.content;
    if (!body?.trim()) {
      return [];
    }
    const parsed = JSON.parse(stripMarkdownJsonFence(body)) as unknown;
    return responseSchema.parse(parsed).candidates;
  } finally {
    clearTimeout(tid);
  }
}
