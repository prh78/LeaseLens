import { safeParseLeaseAnalyseJson, type LeaseAnalyseOutput } from "@/lib/lease/lease-analyse-schema";

const DEFAULT_MODEL = "gpt-4o-mini";
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 400;
const DEFAULT_OPENAI_TIMEOUT_MS = 180_000;

function openAiRequestTimeoutMs(): number {
  const raw = process.env.OPENAI_REQUEST_TIMEOUT_MS?.trim();
  if (raw === undefined || raw === "") {
    return DEFAULT_OPENAI_TIMEOUT_MS;
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    return DEFAULT_OPENAI_TIMEOUT_MS;
  }
  return Math.min(Math.max(Math.floor(n), 15_000), 600_000);
}

function isAbortError(e: unknown): boolean {
  if (e instanceof Error && e.name === "AbortError") {
    return true;
  }
  if (typeof DOMException !== "undefined" && e instanceof DOMException && e.name === "AbortError") {
    return true;
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripMarkdownJsonFence(content: string): string {
  const trimmed = content.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/im.exec(trimmed);
  if (fence?.[1]) {
    return fence[1].trim();
  }
  return trimmed;
}

function parseJsonLenient(content: string): unknown {
  const body = stripMarkdownJsonFence(content);
  return JSON.parse(body) as unknown;
}

const SYSTEM_PROMPT = `You are a conservative UK-style commercial lease analyst. Your job is to read the raw lease text and return ONE JSON object only (no markdown, no commentary).

Rules:
- Output must match the exact keys requested in the user message. Every key must be present.
- Use null for any field you cannot support with clear, explicit wording in the lease.
- Dates must be ISO strings "YYYY-MM-DD" only, or null — never guess a date.
- break_dates and rent_review_dates are arrays of ISO date strings (empty array if none found).
- notice_period_days: integer days or null.
- reinstatement_required and vacant_possession_required: true/false/null only when clearly stated.
- repairing_obligation and service_charge_responsibility: short plain-language summaries or null.
- conditional_break_clause: short summary of conditional break / rolling break mechanics, or null if absent or unclear.
- ambiguous_language: true if you see hedging ("subject to", "TBC", conflicting clauses, illegible OCR-style noise), unclear antecedents, or materially ambiguous obligations; otherwise false.
- manual_review_recommended: true if confidence is low, dates conflict, or ambiguous_language is true; otherwise false (be conservative — prefer true when unsure).
- confidence_score: number between 0 and 1 for overall extraction reliability, or null if not assessable.
- source_snippets: object mapping logical field names (e.g. "commencement_date", "expiry_date") to short verbatim quotes from the lease as **strings only** (never arrays or numbers as values — if you need to cite several dates, join them in one string or use one quote). Use empty object {} only if no quotes are safe to attach.
- field_extraction_meta: object keyed by structured field name (same snake_case keys as the main JSON, e.g. "commencement_date", "expiry_date", "break_dates"). For every key you include, prefer to set "clause_reference" (short cite: clause number, schedule, or paragraph) and "rationale" (one or two sentences on how you read the lease for that field) whenever the lease text gives enough to do so — use null only if truly absent. Each value may also include optional "confidence" (0–1 for that field). Use {} only if you have no per-field notes at all.

Never invent facts. Prefer null and conservative flags over speculation.`;

function buildUserPrompt(leaseText: string): string {
  return `Return a single JSON object with EXACTLY these keys (all required, strict JSON):

{
  "commencement_date": string | null,
  "expiry_date": string | null,
  "break_dates": string[],
  "notice_period_days": number | null,
  "rent_review_dates": string[],
  "repairing_obligation": string | null,
  "service_charge_responsibility": string | null,
  "reinstatement_required": boolean | null,
  "vacant_possession_required": boolean | null,
  "conditional_break_clause": string | null,
  "ambiguous_language": boolean,
  "manual_review_recommended": boolean,
  "confidence_score": number | null,
  "source_snippets": { "<field_name>": "verbatim string quote from the lease text" },
  "field_extraction_meta": { "<field_name>": { "confidence": number | null, "clause_reference": string | null, "rationale": string | null } }
}

Include an entry for each structured field you extracted with non-null values where possible; for each entry, populate clause_reference and rationale from the lease text unless genuinely impossible (then null).

Lease text follows between <<<LEASE>>> and <<<END>>>.

<<<LEASE>>>
${leaseText}
<<<END>>>`;
}

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
  error?: { message?: string };
};

export type OpenAiAnalyseResult = Readonly<{
  data: LeaseAnalyseOutput;
  attemptsUsed: number;
}>;

/**
 * Calls OpenAI Chat Completions with JSON mode, validates with Zod, retries on malformed output.
 */
export async function analyseLeaseTextWithOpenAI(leaseText: string): Promise<OpenAiAnalyseResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;
  const timeoutMs = openAiRequestTimeoutMs();
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: 0.1,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: buildUserPrompt(leaseText) },
          ],
        }),
      });

      const payload = (await res.json()) as ChatCompletionResponse;

      if (!res.ok) {
        throw new Error(payload.error?.message ?? `OpenAI HTTP ${res.status}`);
      }

      const content = payload.choices?.[0]?.message?.content;
      if (typeof content !== "string" || !content.trim()) {
        throw new Error("OpenAI returned empty content.");
      }

      let parsed: unknown;
      try {
        parsed = parseJsonLenient(content);
      } catch (e) {
        throw new Error(`Invalid JSON from model: ${e instanceof Error ? e.message : String(e)}`);
      }

      const checked = safeParseLeaseAnalyseJson(parsed);
      if (!checked.success) {
        throw new Error(
          `Schema validation failed: ${checked.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
        );
      }

      return { data: checked.data, attemptsUsed: attempt };
    } catch (e) {
      lastError = isAbortError(e)
        ? new Error(`OpenAI request timed out after ${timeoutMs}ms.`)
        : e;
      if (attempt < MAX_ATTEMPTS) {
        await sleep(RETRY_DELAY_MS * attempt);
      }
    } finally {
      clearTimeout(tid);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("OpenAI analyse failed after retries.");
}
