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

const fieldSchema = z.enum(["term_commencement_date", "rent_commencement_date", "expiry_date", "break_dates"]);

function isoOrNull(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return ISO.test(trimmed) ? trimmed : null;
}

function isoArrayOrNull(value: unknown): string[] | null {
  if (Array.isArray(value)) {
    const dates = value.map(isoOrNull).filter((v): v is string => v != null);
    return dates.length > 0 ? dates : null;
  }
  const single = isoOrNull(value);
  return single ? [single] : null;
}

function number01OrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.min(1, Math.max(0, value));
  }
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : null;
  }
  return null;
}

function positiveIntegerOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value >= 1) {
    return value;
  }
  if (typeof value === "string") {
    const n = Number.parseInt(value, 10);
    return Number.isInteger(n) && n >= 1 ? n : null;
  }
  return null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 1000) : null;
}

function normaliseVisionCandidate(raw: unknown): VisionDateCandidate | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const o = raw as Record<string, unknown>;
  const fieldCheck = fieldSchema.safeParse(o.field);
  if (!fieldCheck.success) {
    return null;
  }
  const field = fieldCheck.data;
  const valueRaw = o.value ?? o.values ?? o.dates ?? o.date;
  const value = field === "break_dates" ? isoArrayOrNull(valueRaw) : isoOrNull(valueRaw);
  return {
    field,
    value,
    confidence: number01OrNull(o.confidence),
    pageNumber: positiveIntegerOrNull(o.pageNumber ?? o.page ?? o.page_number),
    sourceText: stringOrNull(o.sourceText ?? o.source_text ?? o.evidence ?? o.quote),
    rationale: stringOrNull(o.rationale ?? o.reasoning ?? o.notes),
  };
}

function normaliseVisionResponse(raw: unknown): VisionDateCandidate[] {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return [];
  }
  const candidatesRaw = (raw as Record<string, unknown>).candidates;
  if (!Array.isArray(candidatesRaw)) {
    return [];
  }
  return candidatesRaw
    .map(normaliseVisionCandidate)
    .filter((candidate): candidate is VisionDateCandidate => candidate != null);
}

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
- Return strict JSON only. For break_dates, value must be an array of ISO dates or null:
{ "candidates": [{ "field": "term_commencement_date" | "rent_commencement_date" | "expiry_date" | "break_dates", "value": "YYYY-MM-DD" | ["YYYY-MM-DD"] | null, "confidence": 0-1 | null, "pageNumber": number | null, "sourceText": string | null, "rationale": string | null }] }`;

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
    return normaliseVisionResponse(parsed);
  } finally {
    clearTimeout(tid);
  }
}
