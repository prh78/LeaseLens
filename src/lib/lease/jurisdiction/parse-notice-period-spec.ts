import type { Json } from "@/lib/supabase/database.types";
import {
  NOTICE_ANCHORS,
  NOTICE_DAY_BASIS,
  NOTICE_PERIOD_UNITS,
  type NoticeAnchor,
  type NoticeDayBasis,
  type NoticePeriodSpec,
  type NoticePeriodUnit,
} from "@/lib/lease/jurisdiction/types";

function isNoticePeriodUnit(value: string): value is NoticePeriodUnit {
  return (NOTICE_PERIOD_UNITS as readonly string[]).includes(value);
}

function isNoticeDayBasis(value: string): value is NoticeDayBasis {
  return (NOTICE_DAY_BASIS as readonly string[]).includes(value);
}

function isNoticeAnchor(value: string): value is NoticeAnchor {
  return (NOTICE_ANCHORS as readonly string[]).includes(value);
}

/** Parses model / DB JSON into a validated notice period spec. */
export function parseNoticePeriodSpec(raw: unknown): NoticePeriodSpec | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const o = raw as Record<string, unknown>;
  const value = o.value;
  const unit = o.unit;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 1 || typeof unit !== "string") {
    return null;
  }
  if (!isNoticePeriodUnit(unit)) {
    return null;
  }
  let day_basis: NoticeDayBasis | null = null;
  if (typeof o.day_basis === "string" && isNoticeDayBasis(o.day_basis)) {
    day_basis = o.day_basis;
  }
  let anchor: NoticeAnchor | null = null;
  if (typeof o.anchor === "string" && isNoticeAnchor(o.anchor)) {
    anchor = o.anchor;
  }
  const sourceRaw = o.source_text;
  const source_text =
    typeof sourceRaw === "string" && sourceRaw.trim().length > 0 ? sourceRaw.trim().slice(0, 500) : null;
  return {
    value: Math.floor(value),
    unit,
    day_basis,
    anchor,
    source_text,
  };
}

export function noticePeriodSpecToJson(spec: NoticePeriodSpec | null): Json | null {
  if (!spec) {
    return null;
  }
  return {
    value: spec.value,
    unit: spec.unit,
    ...(spec.day_basis ? { day_basis: spec.day_basis } : {}),
    ...(spec.anchor ? { anchor: spec.anchor } : {}),
    ...(spec.source_text ? { source_text: spec.source_text } : {}),
  };
}
