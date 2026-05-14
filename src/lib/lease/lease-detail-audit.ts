import { LEASE_DOCUMENT_TYPE_LABEL } from "@/lib/lease/lease-document-types";
import { mergeStructuredLeaseFields, MERGEABLE_STRUCTURED_KEYS } from "@/lib/lease/merge-structured-lease-fields";
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

  const after = mergeStructuredLeaseFields(merged, patch, keys);
  const sup = ctx.supplemental;
  const eff = effectiveDate(sup.upload_date);
  const supLabel = LEASE_DOCUMENT_TYPE_LABEL[sup.document_type];

  for (const key of keys) {
    const beforeVal = merged[key];
    const afterVal = after[key];
    if (stable(key, beforeVal) === stable(key, afterVal)) {
      continue;
    }

    const keyStr = String(key);
    const prevProv = ctx.provenance[keyStr];
    if (
      prevProv?.source_document_id &&
      prevProv.source_document_id !== ctx.primaryDocumentId &&
      prevProv.source_document_id !== sup.id
    ) {
      ctx.conflicts.push({
        field: keyStr,
        conflicting_values: [
          {
            document_id: prevProv.source_document_id,
            label: prevProv.source_label,
            value_preview: truncatePreview(beforeVal),
          },
          {
            document_id: sup.id,
            label: supLabel,
            value_preview: truncatePreview(afterVal),
            snippet: firstSnippet(patch.source_snippets),
          },
        ],
      });
    }

    ctx.changeHistory.push({
      field: keyStr,
      previous_value: beforeVal as unknown,
      new_value: afterVal as unknown,
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

  return after;
}
