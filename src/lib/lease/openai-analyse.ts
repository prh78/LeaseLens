import { buildAnalyseSystemPrompt, buildAnalyseUserPrompt } from "@/lib/lease/jurisdiction/analyse-prompts";
import { isLeaseJurisdiction, type LeaseJurisdiction } from "@/lib/lease/jurisdiction/types";
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
export async function analyseLeaseTextWithOpenAI(
  leaseText: string,
  jurisdiction: LeaseJurisdiction = "uk",
): Promise<OpenAiAnalyseResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const region = isLeaseJurisdiction(jurisdiction) ? jurisdiction : "uk";
  const systemPrompt = buildAnalyseSystemPrompt(region);
  const userPrompt = buildAnalyseUserPrompt(leaseText);

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
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
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
