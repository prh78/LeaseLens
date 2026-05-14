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
- Use null for any date field you cannot support with clear, explicit wording in the lease.
- Dates must be ISO strings "YYYY-MM-DD" only, or null — never guess a date.
- break_dates and rent_review_dates are arrays of ISO date strings (empty array if none found).
- notice_period_days: integer days or null.
- reinstatement_required and vacant_possession_required: true/false/null only when clearly stated.
- repairing_obligation and service_charge_responsibility: short plain-language summaries or null.
- conditional_break_clause: short summary of conditional break / rolling break mechanics, or null if absent or unclear.
- ambiguous_language: true if you see hedging ("subject to", "TBC", conflicting clauses, illegible OCR-style noise), unclear antecedents, or materially ambiguous obligations; otherwise false.

DATE CLASSIFICATION (critical — do not conflate types):

1) term_commencement_date — legal commencement of the lease TERM (when the contractual term begins).
   Typical labels/phrases: "Term Commencement Date", "Lease Commencement Date", "The Term shall commence on", "the term begins on", "commencement of the Term".
   Use for lease term / expiry context when the instrument ties the term to this date.

2) rent_commencement_date — when RENTAL payment obligations first arise (may match term commencement or be later, e.g. rent-free / fitting-out).
   Typical labels/phrases: "Rent Commencement Date", "Initial Rent Payment Date", "Rent shall first be payable on", "Rental payments shall commence on".
   Do NOT put rent review anniversaries here. Do NOT infer rent commencement from a rent review clause alone.

3) rent_review_dates — scheduled dates or explicit calendar points when RENT is reassessed / reviewed (upward-only review, indexation review, fifth anniversary review, etc.).
   Typical labels/phrases: "Rent Review Date", "reviewed on each anniversary", "on the fifth anniversary of …".
   Do NOT put the first day rent becomes payable here unless the lease explicitly frames that date as a rent REVIEW (rare). If language could mean either rent start or review, prefer null for the unclear field and record a date_ambiguities entry.

date_field_confidence: REQUIRED object with exactly three keys. For each key, output a number 0–1 or null:
- term_commencement_date — confidence in your classification of the term start date.
- rent_commencement_date — confidence in rent start vs other dates (null if rent_commencement_date is null and you had nothing to score).
- rent_review_dates — confidence in the set of review dates as a whole (null if the array is empty and there was nothing to score).
Use lower scores when wording is indirect, defined by reference to another agreement, or could overlap another date type.

date_ambiguities: REQUIRED array of objects { "code": string, "detail": string | null }.
   Add an entry whenever date wording is ambiguous, cross-referenced unclearly, or two clauses could support different classifications (e.g. single date labelled only "Commencement Date" without making term vs rent clear).
   Use stable snake_case codes such as: "term_vs_rent_unclear", "possible_review_vs_rent_start", "conflicting_dates", "defined_by_reference_unclear", "ocr_or_text_noise".
   If everything is clear, return an empty array [].

manual_review_recommended: true if human verification is prudent (low confidence, ambiguities, conflicting clauses, or ambiguous_language); false only when you are confident classifications are sound.

confidence_score: number between 0 and 1 for overall extraction reliability, or null if not assessable.

source_snippets: object mapping logical field names to short verbatim quotes from the lease as **strings only** (never arrays or numbers as values — if you need to cite several dates, join them in one string or use one quote). Include keys such as "term_commencement_date", "rent_commencement_date", "rent_review_dates", "expiry_date" where helpful. Use empty object {} only if no quotes are safe to attach.

field_extraction_meta: object keyed by structured field name (same snake_case keys as the main JSON, including term_commencement_date, rent_commencement_date, rent_review_dates, expiry_date, break_dates). For every key you include, prefer "clause_reference" and "rationale"; each value may also include optional "confidence" (0–1 for that field). Use {} only if you have no per-field notes at all.

Never invent facts. Prefer null, date_ambiguities entries, and conservative flags over speculation.`;

function buildUserPrompt(leaseText: string): string {
  return `Return a single JSON object with EXACTLY these keys (all required, strict JSON):

{
  "term_commencement_date": string | null,
  "rent_commencement_date": string | null,
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
  "date_field_confidence": {
    "term_commencement_date": number | null,
    "rent_commencement_date": number | null,
    "rent_review_dates": number | null
  },
  "date_ambiguities": { "code": string, "detail": string | null }[],
  "source_snippets": { "<field_name>": "verbatim string quote from the lease text" },
  "field_extraction_meta": { "<field_name>": { "confidence": number | null, "clause_reference": string | null, "rationale": string | null } }
}

Include field_extraction_meta entries for important date fields where possible; align rationale with date_ambiguities when you record uncertainties.

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
