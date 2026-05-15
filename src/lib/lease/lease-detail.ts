import { DEFAULT_DISPLAY_LOCALE, formatAppDate } from "@/lib/lease/format-app-date";
import type { Json } from "@/lib/supabase/database.types";

export function jsonStringArray(value: Json): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((v): v is string => typeof v === "string");
}

export function jsonSnippetMap(value: Json): Record<string, string> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === "string" && v.trim()) {
      out[k] = v;
    }
  }
  return out;
}

/** @param locale BCP 47 display locale (defaults to en-GB). */
export function formatIsoDate(iso: string | null | undefined, locale: string = DEFAULT_DISPLAY_LOCALE): string | null {
  return formatAppDate(iso, locale);
}

export function humanizeKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
