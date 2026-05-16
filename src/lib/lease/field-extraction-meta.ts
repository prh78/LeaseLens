import type { Json } from "@/lib/supabase/database.types";

/** Per-field explainability from structured extraction (stored in `extracted_data.field_extraction_meta`). */
export type FieldExtractionMetaEntry = Readonly<{
  confidence?: number | null;
  rationale?: string | null;
  clause_reference?: string | null;
}>;

/** Structured model output: confidence 0–1 per commercial date grouping (stored in `extracted_data.date_field_confidence`). */
export const DATE_FIELD_CONFIDENCE_KEYS = [
  "term_commencement_date",
  "rent_commencement_date",
  "rent_review_dates",
] as const;

export type DateFieldConfidenceKey = (typeof DATE_FIELD_CONFIDENCE_KEYS)[number];

export type DateFieldConfidenceMap = Readonly<Partial<Record<DateFieldConfidenceKey, number | null>>>;

export type DateAmbiguityItem = Readonly<{
  code: string;
  detail: string | null;
}>;

const DATE_CONF_FIELD_SET = new Set<string>(DATE_FIELD_CONFIDENCE_KEYS);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function firstNonEmptyStringFromRecord(r: Record<string, unknown>, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const x = r[key];
    if (typeof x !== "string") {
      continue;
    }
    const t = x.trim();
    if (t.length > 0) {
      return t;
    }
  }
  return undefined;
}

const FIELD_META_ALIASES: Record<string, readonly string[]> = {
  repairing_obligation: ["repair", "repairs", "repairing", "repairing_covenant", "tenant_repair"],
  reinstatement_required: ["reinstatement", "reinstatement_obligation", "yield_up", "yielding_up"],
  service_charge_responsibility: ["service_charge", "service_charges", "service_costs", "outgoings"],
  vacant_possession_required: ["vacant_possession", "possession", "yield_up_vacant_possession"],
  conditional_break_clause: ["break_clause", "break_option", "conditional_break", "termination_option"],
};

function normalizeFieldMetaKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function canonicalFieldForMetaKey(field: string): string | null {
  const normalized = normalizeFieldMetaKey(field);
  for (const [canonical, aliases] of Object.entries(FIELD_META_ALIASES)) {
    const candidates = [canonical, ...aliases].map(normalizeFieldMetaKey);
    if (candidates.some((candidate) => normalized === candidate || normalized.includes(candidate))) {
      return canonical;
    }
  }
  return null;
}

export function parseFieldExtractionMeta(raw: Json | null | undefined): Record<string, FieldExtractionMetaEntry> {
  if (raw == null || !isRecord(raw)) {
    return {};
  }
  const out: Record<string, FieldExtractionMetaEntry> = {};
  for (const [field, v] of Object.entries(raw)) {
    if (!isRecord(v)) {
      continue;
    }
    const r = v as Record<string, unknown>;
    const confidence =
      typeof r.confidence === "number" && Number.isFinite(r.confidence)
        ? Math.min(1, Math.max(0, r.confidence))
        : r.confidence === null
          ? null
          : undefined;

    const rationaleStr = firstNonEmptyStringFromRecord(r, [
      "rationale",
      "reasoning",
      "notes",
      "explanation",
      "summary",
      "evidence",
    ]);
    const rationale =
      rationaleStr !== undefined
        ? rationaleStr
        : typeof r.rationale === "string"
          ? r.rationale
          : typeof r.reasoning === "string"
            ? r.reasoning
            : r.rationale === null
              ? null
              : r.reasoning === null
                ? null
                : undefined;

    const clauseStr = firstNonEmptyStringFromRecord(r, [
      "clause_reference",
      "clauseReference",
      "clause",
      "clause_ref",
      "schedule_reference",
      "cite",
    ]);
    const clause_reference =
      clauseStr !== undefined
        ? clauseStr
        : typeof r.clause_reference === "string"
          ? r.clause_reference
          : typeof r.clauseReference === "string"
            ? r.clauseReference
            : r.clause_reference === null
              ? null
              : r.clauseReference === null
                ? null
                : undefined;

    if (confidence !== undefined || rationale !== undefined || clause_reference !== undefined) {
      const entry = { confidence, rationale, clause_reference };
      out[field] = entry;
      const canonical = canonicalFieldForMetaKey(field);
      if (canonical && out[canonical] === undefined) {
        out[canonical] = entry;
      }
    }
  }
  return out;
}

function coerce01(v: unknown): number | null {
  if (v === null || v === undefined) {
    return null;
  }
  if (typeof v === "number" && Number.isFinite(v)) {
    return Math.min(1, Math.max(0, v));
  }
  return null;
}

/** Parses persisted `date_field_confidence` JSON from analyse output. */
export function parseDateFieldConfidence(raw: Json | null | undefined): DateFieldConfidenceMap {
  if (raw == null || !isRecord(raw)) {
    return {};
  }
  const out: Partial<Record<DateFieldConfidenceKey, number | null>> = {};
  for (const key of DATE_FIELD_CONFIDENCE_KEYS) {
    const c = coerce01(raw[key]);
    if (c !== null) {
      out[key] = c;
    } else if (raw[key] === null) {
      out[key] = null;
    }
  }
  return out;
}

/** Parses `date_ambiguities` JSON array from analyse output. */
export function parseDateAmbiguities(raw: Json | null | undefined): DateAmbiguityItem[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: DateAmbiguityItem[] = [];
  for (const item of raw) {
    if (!isRecord(item)) {
      continue;
    }
    const code = typeof item.code === "string" ? item.code.trim() : "";
    if (!code) {
      continue;
    }
    const detail =
      item.detail === null || item.detail === undefined
        ? null
        : typeof item.detail === "string"
          ? item.detail.trim() || null
          : null;
    out.push({ code, detail });
  }
  return out;
}

/** Effective confidence for a field: per-field meta, else date-field map (for date keys), else global model score. */
export function effectiveFieldConfidence(
  field: string,
  meta: Record<string, FieldExtractionMetaEntry>,
  globalScore: number | null | undefined,
  dateFieldConfidence?: DateFieldConfidenceMap | null,
): number | null {
  const row = meta[field];
  const c = row?.confidence;
  if (typeof c === "number" && Number.isFinite(c)) {
    return Math.min(1, Math.max(0, c));
  }
  if (dateFieldConfidence && DATE_CONF_FIELD_SET.has(field)) {
    const key = field as DateFieldConfidenceKey;
    const dc = dateFieldConfidence[key];
    if (typeof dc === "number" && Number.isFinite(dc)) {
      return Math.min(1, Math.max(0, dc));
    }
  }
  if (globalScore != null && Number.isFinite(globalScore)) {
    return Math.min(1, Math.max(0, globalScore));
  }
  return null;
}

export type ConfidenceBand = "high" | "medium" | "low" | "unrated";

export function confidenceBand(score: number | null): ConfidenceBand {
  if (score == null || Number.isNaN(score)) {
    return "unrated";
  }
  if (score >= 0.78) {
    return "high";
  }
  if (score >= 0.55) {
    return "medium";
  }
  return "low";
}
