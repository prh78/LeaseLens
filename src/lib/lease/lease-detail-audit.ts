import { LEASE_DOCUMENT_TYPE_LABEL } from "@/lib/lease/lease-document-types";
import { MERGEABLE_STRUCTURED_KEYS } from "@/lib/lease/merge-structured-lease-fields";
import type { LeaseAnalyseOutput } from "@/lib/lease/lease-analyse-schema";
import type { LeaseDocumentType } from "@/lib/supabase/database.types";

export type FieldProvenanceEntry = Readonly<{
  source_document_id: string | null;
  source_document_type: LeaseDocumentType | string;
  source_label: string;
  effective_date: string;
}>;

export type FieldProvenanceMap = Readonly<Record<string, FieldProvenanceEntry>>;

export type ChangeHistoryEntry = Readonly<{
  field: string;
  previous_value: unknown;
  new_value: unknown;
  source_document_id: string;
  source_label: string;
  effective_date: string;
}>;

export type DocumentConflictEntry = Readonly<{
  field: string;
  conflicting_values: ReadonlyArray<{
    document_id: string | null;
    label: string;
    value_preview: string;
    snippet?: string;
  }>;
}>;

type ConflictValueRow = {
  document_id: string | null;
  label: string;
  value_preview: string;
  snippet?: string;
};

type MutableConflictEntry = { field: string; conflicting_values: ConflictValueRow[] };

function effectiveDate(uploadDateTs: string): string {
  const d = new Date(uploadDateTs);
  if (Number.isNaN(d.getTime())) {
    return uploadDateTs.slice(0, 10);
  }
  return d.toISOString().slice(0, 10);
}

function stable(key: keyof LeaseAnalyseOutput, value: unknown): string {
  return JSON.stringify(value);
}

function truncatePreview(value: unknown, max = 140): string {
  const s = typeof value === "string" ? value : JSON.stringify(value);
  if (s.length <= max) {
    return s;
  }
  return `${s.slice(0, max)}…`;
}

const FIELD_EVIDENCE_ALIASES: Record<string, readonly string[]> = {
  term_commencement_date: [
    "term_commencement",
    "commencement_date",
    "lease_commencement",
    "term_start",
    "start_date",
    "date_of_commencement",
  ],
  rent_commencement_date: [
    "rent_commencement",
    "rent_start",
    "rent_start_date",
    "rent_payment_start",
    "rent_free",
    "rent_free_period",
  ],
  expiry_date: ["expiry", "expiration", "lease_expiry", "term_expiry", "term_end", "end_date", "lease_term"],
  notice_period_days: ["notice_period", "notice", "break_notice", "termination_notice", "notice_required"],
  repairing_obligation: ["repair", "repairs", "repairing", "tenant_repair", "repairing_covenant"],
  reinstatement_required: ["reinstatement", "reinstatement_obligation", "yield_up", "yielding_up"],
  service_charge_responsibility: ["service_charge", "service_charges", "service_costs", "outgoings"],
  vacant_possession_required: ["vacant_possession", "possession", "yield_up_vacant_possession"],
  conditional_break_clause: ["break_clause", "break_option", "conditional_break", "termination_option"],
};

const FIELD_EVIDENCE_TEXT_KEYWORDS: Record<string, readonly string[]> = {
  term_commencement_date: [
    "term commencement",
    "commencement date",
    "commencing on",
    "term shall commence",
    "date of commencement",
  ],
  rent_commencement_date: [
    "rent commencement",
    "rent shall commence",
    "rent payment",
    "rent free",
    "rent-free",
    "first payment of rent",
  ],
  expiry_date: ["expiry", "expiration", "expire", "term end", "term shall end", "end of the term"],
  notice_period_days: ["notice period", "not less than", "months' notice", "months notice", "days' notice", "days notice"],
  repairing_obligation: ["repair", "repairs", "repairing", "keep in repair", "tenant shall repair"],
  reinstatement_required: ["reinstatement", "reinstate", "yield up", "remove alterations", "make good"],
  service_charge_responsibility: ["service charge", "service charges", "service costs", "outgoings"],
  vacant_possession_required: ["vacant possession", "give vacant possession", "yield up"],
  conditional_break_clause: ["break clause", "break option", "break date", "terminate", "termination option"],
};

/** Substrings of structured field names that are too generic to match snippet keys (avoids `date` matching `break_dates`). */
const SNIPPET_KEY_NOISE_TOKENS = new Set([
  "date",
  "dates",
  "day",
  "days",
]);

function normalizeSnippetKeyOrField(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function evidenceAliasesForField(field: string): string[] {
  const normalized = normalizeSnippetKeyOrField(field);
  return [normalized, ...(FIELD_EVIDENCE_ALIASES[normalized] ?? [])].map(normalizeSnippetKeyOrField);
}

function evidenceTextKeywordsForField(field: string): string[] {
  const normalized = normalizeSnippetKeyOrField(field);
  return (FIELD_EVIDENCE_TEXT_KEYWORDS[normalized] ?? [])
    .map((keyword) => keyword.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Whether a `source_snippets` entry key plausibly belongs to this structured field.
 * Uses exact normalized key match, then token overlap excluding generic date/day tokens.
 */
function snippetKeyRelatesToStructuredField(normalizedSnippetKey: string, normalizedField: string): boolean {
  for (const candidate of evidenceAliasesForField(normalizedField)) {
    if (normalizedSnippetKey === candidate || normalizedSnippetKey.includes(candidate)) {
      return true;
    }
    const tokens = candidate
      .split("_")
      .filter((p) => p.length >= 3 && !SNIPPET_KEY_NOISE_TOKENS.has(p));
    if (tokens.length > 0 && tokens.every((t) => normalizedSnippetKey.includes(t))) {
      return true;
    }
  }
  return false;
}

/**
 * Best-effort excerpt from `source_snippets` for a structured field (operative terms + conflict UI).
 * Prefers an exact key match; never falls back to an unrelated snippet.
 */
export function snippetEvidenceForField(field: string, snippets: Record<string, string>): string | undefined {
  const normalizedField = normalizeSnippetKeyOrField(field);
  const aliases = evidenceAliasesForField(normalizedField);
  const textKeywords = evidenceTextKeywordsForField(normalizedField);

  const clip = (text: string): string => {
    const t = text.trim();
    if (!t) {
      return "";
    }
    return t.length <= 800 ? t : `${t.slice(0, 800)}…`;
  };

  for (const [k, v] of Object.entries(snippets)) {
    if (aliases.includes(normalizeSnippetKeyOrField(k))) {
      const out = clip(v);
      if (out) {
        return out;
      }
    }
  }

  for (const [k, v] of Object.entries(snippets)) {
    const t = v?.trim();
    if (!t) {
      continue;
    }
    if (snippetKeyRelatesToStructuredField(normalizeSnippetKeyOrField(k), normalizedField)) {
      return clip(v);
    }
  }

  for (const [, v] of Object.entries(snippets)) {
    const t = v?.trim();
    if (!t) {
      continue;
    }
    const normalizedText = t.toLowerCase();
    if (textKeywords.some((keyword) => normalizedText.includes(keyword))) {
      return clip(v);
    }
  }
  return undefined;
}

function appendFieldConflict(
  conflicts: MutableConflictEntry[],
  field: string,
  rows: readonly ConflictValueRow[],
): void {
  let entry = conflicts.find((c) => c.field === field);
  if (!entry) {
    entry = { field, conflicting_values: [] };
    conflicts.push(entry);
  }
  for (const r of rows) {
    const dup = entry.conflicting_values.some(
      (x) => x.document_id === r.document_id && x.value_preview === r.value_preview && x.label === r.label,
    );
    if (!dup) {
      entry.conflicting_values.push(r);
    }
  }
}

function isEmptySupplementalValue(value: unknown): boolean {
  if (value == null) {
    return true;
  }
  if (typeof value === "string") {
    return value.trim().length === 0;
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  return false;
}

function shouldApplySupplementalValue(currentValue: unknown, patchValue: unknown): boolean {
  if (isEmptySupplementalValue(patchValue) && !isEmptySupplementalValue(currentValue)) {
    return false;
  }
  return true;
}

export function buildInitialProvenance(primary: Readonly<{ id: string; upload_date: string }>): FieldProvenanceMap {
  const ed = effectiveDate(primary.upload_date);
  const label = LEASE_DOCUMENT_TYPE_LABEL.primary_lease;
  const out: Record<string, FieldProvenanceEntry> = {};
  for (const key of MERGEABLE_STRUCTURED_KEYS) {
    if (key === "field_extraction_meta" || key === "source_snippets") {
      continue;
    }
    out[key] = {
      source_document_id: primary.id,
      source_document_type: "primary_lease",
      source_label: label,
      effective_date: ed,
    };
  }
  return out;
}

/**
 * Merges supplemental structured output and records provenance, change history, and overlapping-amendment conflicts.
 * When two non-primary documents disagree on the same field, the newer patch is **not** applied for that field,
 * provenance is unchanged, and a conflict record is stored with snippet evidence for manual review.
 */
export function mergeSupplementalWithAudit(
  merged: LeaseAnalyseOutput,
  patch: LeaseAnalyseOutput,
  keys: readonly (keyof LeaseAnalyseOutput)[],
  ctx: Readonly<{
    primaryDocumentId: string;
    supplemental: Readonly<{ id: string; document_type: LeaseDocumentType; upload_date: string }>;
    provenance: Record<string, FieldProvenanceEntry>;
    changeHistory: ChangeHistoryEntry[];
    conflicts: DocumentConflictEntry[];
  }>,
): LeaseAnalyseOutput {
  if (keys.length === 0) {
    return merged;
  }

  const sup = ctx.supplemental;
  const eff = effectiveDate(sup.upload_date);
  const supLabel = LEASE_DOCUMENT_TYPE_LABEL[sup.document_type];

  const mutableConflicts = ctx.conflicts as unknown as MutableConflictEntry[];

  let result: LeaseAnalyseOutput = { ...merged };
  const appliedStructuredKeys: (keyof LeaseAnalyseOutput)[] = [];
  let anyConflictThisPatch = false;

  const structuredKeys = keys.filter((k) => k !== "source_snippets" && k !== "field_extraction_meta");

  for (const key of structuredKeys) {
    const keyStr = String(key);
    const beforeVal = result[key];
    const patchVal = patch[key];
    if (!shouldApplySupplementalValue(beforeVal, patchVal)) {
      continue;
    }
    if (stable(key, beforeVal) === stable(key, patchVal)) {
      continue;
    }

    const prevProv = ctx.provenance[keyStr];
    const hasMultiDocConflict =
      Boolean(prevProv?.source_document_id) &&
      prevProv.source_document_id !== ctx.primaryDocumentId &&
      prevProv.source_document_id !== sup.id;

    if (hasMultiDocConflict && prevProv) {
      anyConflictThisPatch = true;
      const snippetPrior = snippetEvidenceForField(keyStr, result.source_snippets);
      const snippetNew = snippetEvidenceForField(keyStr, patch.source_snippets);
      appendFieldConflict(mutableConflicts, keyStr, [
        {
          document_id: prevProv.source_document_id,
          label: prevProv.source_label,
          value_preview: truncatePreview(beforeVal),
          snippet: snippetPrior,
        },
        {
          document_id: sup.id,
          label: supLabel,
          value_preview: truncatePreview(patchVal),
          snippet: snippetNew,
        },
      ]);
      continue;
    }

    (result as Record<string, unknown>)[keyStr] = patchVal as unknown;
    appliedStructuredKeys.push(key);

    ctx.changeHistory.push({
      field: keyStr,
      previous_value: beforeVal as unknown,
      new_value: patchVal as unknown,
      source_document_id: sup.id,
      source_label: supLabel,
      effective_date: eff,
    });

    ctx.provenance[keyStr] = {
      source_document_id: sup.id,
      source_document_type: sup.document_type,
      source_label: supLabel,
      effective_date: eff,
    };
  }

  result.source_snippets = { ...merged.source_snippets };
  for (const key of appliedStructuredKeys) {
    const fk = String(key);
    for (const [sk, text] of Object.entries(patch.source_snippets)) {
      if (snippetKeyRelatesToStructuredField(normalizeSnippetKeyOrField(sk), normalizeSnippetKeyOrField(fk))) {
        result.source_snippets = { ...result.source_snippets, [sk]: text };
      }
    }
  }

  if (keys.includes("source_snippets") && !anyConflictThisPatch) {
    result.source_snippets = { ...result.source_snippets, ...patch.source_snippets };
  }

  result.field_extraction_meta = { ...(merged.field_extraction_meta ?? {}) };
  for (const key of appliedStructuredKeys) {
    const fk = String(key);
    const pm = patch.field_extraction_meta?.[fk];
    if (pm && typeof pm === "object") {
      const cur = result.field_extraction_meta[fk] ?? {};
      result.field_extraction_meta = {
        ...result.field_extraction_meta,
        [fk]: { ...cur, ...pm },
      };
    }
  }
  if (keys.includes("field_extraction_meta") && !anyConflictThisPatch) {
    result.field_extraction_meta = {
      ...(merged.field_extraction_meta ?? {}),
      ...patch.field_extraction_meta,
    };
  }

  return result;
}
