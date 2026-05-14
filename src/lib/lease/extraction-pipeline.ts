import type { ExtractionStatus } from "@/lib/supabase/database.types";

/** Ordered pipeline steps shown on the dashboard (failed is handled separately). */
export const EXTRACTION_PIPELINE_STEPS = [
  { id: "upload", label: "Uploading PDF" },
  { id: "extract", label: "Extracting text" },
  { id: "analyse", label: "Analysing lease" },
  { id: "risks", label: "Calculating risks" },
  { id: "complete", label: "Complete" },
] as const;

/** Active step index 0–4 while running; `null` when terminal complete; `-1` for failed. */
export function extractionPipelineStep(status: ExtractionStatus): number | null {
  switch (status) {
    case "uploading":
      return 0;
    case "extracting":
      return 1;
    case "analysing":
      return 2;
    case "calculating_risks":
      return 3;
    case "complete":
      return null;
    case "failed":
      return -1;
  }
}

export function extractionProgressHeadline(status: ExtractionStatus): string {
  if (status === "failed") {
    return "Failed";
  }
  if (status === "complete") {
    return "Complete";
  }
  const step = extractionPipelineStep(status);
  if (step === null || step < 0) {
    return "Processing";
  }
  return EXTRACTION_PIPELINE_STEPS[step]?.label ?? "Processing";
}

export function isExtractionProcessing(status: ExtractionStatus): boolean {
  return status !== "complete" && status !== "failed";
}
