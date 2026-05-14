import type {
  ChangeHistoryEntry,
  DocumentConflictEntry,
  FieldProvenanceEntry,
} from "@/lib/lease/lease-detail-audit";
import type { Json } from "@/lib/supabase/database.types";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function parseFieldProvenance(raw: Json | null | undefined): Record<string, FieldProvenanceEntry> {
  if (raw == null || !isRecord(raw)) {
    return {};
  }
  const out: Record<string, FieldProvenanceEntry> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!isRecord(v)) {
      continue;
    }
    const id = typeof v.source_document_id === "string" ? v.source_document_id : null;
    const type = typeof v.source_document_type === "string" ? v.source_document_type : "";
    const label = typeof v.source_label === "string" ? v.source_label : "";
    const effective = typeof v.effective_date === "string" ? v.effective_date : "";
    if (!label) {
      continue;
    }
    out[k] = {
      source_document_id: id,
      source_document_type: type,
      source_label: label,
      effective_date: effective,
    };
  }
  return out;
}

export function parseChangeHistory(raw: Json | null | undefined): ChangeHistoryEntry[] {
  if (raw == null || !Array.isArray(raw)) {
    return [];
  }
  const out: ChangeHistoryEntry[] = [];
  for (const item of raw) {
    if (!isRecord(item)) {
      continue;
    }
    const field = typeof item.field === "string" ? item.field : "";
    if (!field) {
      continue;
    }
    out.push({
      field,
      previous_value: item.previous_value,
      new_value: item.new_value,
      source_document_id: typeof item.source_document_id === "string" ? item.source_document_id : "",
      source_label: typeof item.source_label === "string" ? item.source_label : "",
      effective_date: typeof item.effective_date === "string" ? item.effective_date : "",
    });
  }
  return out;
}

export function parseDocumentConflicts(raw: Json | null | undefined): DocumentConflictEntry[] {
  if (raw == null || !Array.isArray(raw)) {
    return [];
  }
  const out: DocumentConflictEntry[] = [];
  for (const item of raw) {
    if (!isRecord(item)) {
      continue;
    }
    const field = typeof item.field === "string" ? item.field : "";
    const cv = item.conflicting_values;
    if (!field || !Array.isArray(cv)) {
      continue;
    }
    const conflicting_values = cv
      .map((row) => {
        if (!isRecord(row)) {
          return null;
        }
        return {
          document_id: typeof row.document_id === "string" ? row.document_id : null,
          label: typeof row.label === "string" ? row.label : "",
          value_preview: typeof row.value_preview === "string" ? row.value_preview : "",
          snippet: typeof row.snippet === "string" ? row.snippet : undefined,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x != null && x.label.length > 0);
    if (conflicting_values.length > 0) {
      out.push({ field, conflicting_values });
    }
  }
  return out;
}
