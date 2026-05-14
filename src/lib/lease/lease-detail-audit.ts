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

function firstSnippet(snippets: Record<string, string>): string | undefined {
  const first = Object.values(snippets)[0];
  if (!first) {
    return undefined;
  }
  const t = first.trim();
  return t.length <= 200 ? t : `${t.slice(0, 200)}…`;
}

function snippetKeyRelatesToStructuredField(snippetKey: string, structuredField: string): boolean {
  const sk = snippetKey.toLowerCase().replace(/\s+/g, "_");
  const sf = structuredField.toLowerCase();
  if (sk === sf) {
    return true;
  }
  const tokens = sf.split("_").filter((p) => p.length >= 3);
  return tokens.some((t) => sk.includes(t));
}

/**
 * Best-effort excerpt from `source_snippets` for a structured field (for conflict UI).
 */
export function snippetEvidenceForField(field: string, snippets: Record<string, string>): string | undefined {
  for (const [k, v] of Object.entries(snippets)) {
    const t = v?.trim();
    if (!t) {
      continue;
    }
    if (snippetKeyRelatesToStructuredField(k, field)) {
      return t.length <= 800 ? t : `${t.slice(0, 800)}…`;
    }
  }
  return firstSnippet(snippets);
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

export function buildInitialProvenance(primary: Readonly<{ id: string; upload_date: string }>): FieldProvenanceMap {
  const ed = effectiveDate(primary.upload_date);
  const label = LEASE_DOCUMENT_TYPE_LABEL.primary_lease;
  const out: Record<string, FieldProvenanceEntry> = {};
  for (const key of MERGEABLE_STRUCTURED_KEYS) {
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

  const structuredKeys = keys.filter((k) => k !== "source_snippets");

  for (const key of structuredKeys) {
    const keyStr = String(key);
    const beforeVal = result[key];
    const patchVal = patch[key];
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
      if (snippetKeyRelatesToStructuredField(sk, fk)) {
        result.source_snippets = { ...result.source_snippets, [sk]: text };
      }
    }
  }

  if (keys.includes("source_snippets") && !anyConflictThisPatch) {
    result.source_snippets = { ...result.source_snippets, ...patch.source_snippets };
  }

  return result;
}
