export const PROPERTY_TYPES = [
  { value: "office", label: "Office" },
  { value: "retail", label: "Retail" },
  { value: "industrial", label: "Industrial" },
  { value: "residential", label: "Residential" },
  { value: "mixed", label: "Mixed use" },
  { value: "other", label: "Other" },
] as const;

export type PropertyTypeValue = (typeof PROPERTY_TYPES)[number]["value"];

export function isPropertyType(value: string): value is PropertyTypeValue {
  return PROPERTY_TYPES.some((item) => item.value === value);
}
