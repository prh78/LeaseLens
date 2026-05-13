import pdfParse from "pdf-parse";

export type PdfTextExtractionResult = Readonly<{
  text: string;
  pageCount: number;
  warnings: string[];
}>;

/** Heuristic: very little text per page often means scanned or image-only PDFs. */
const MIN_CHARS_PER_PAGE_GUESS = 30;

/**
 * Extract embedded text from a PDF buffer (digital text layer only).
 * Scanned PDFs typically yield empty or very short text; callers get `warnings` instead of a hard error.
 */
export async function extractTextFromPdfBuffer(data: Buffer): Promise<PdfTextExtractionResult> {
  const warnings: string[] = [];

  let parsed: { text?: string; numpages?: number };
  try {
    parsed = await pdfParse(data);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "PDF parse failed.";
    throw new Error(`Could not read PDF structure: ${message}`);
  }

  const pageCount = typeof parsed.numpages === "number" && parsed.numpages > 0 ? parsed.numpages : 0;
  const raw = typeof parsed.text === "string" ? parsed.text : "";
  const text = raw.replace(/\u0000/g, "").trimEnd();

  const nonWhitespace = text.replace(/\s+/g, "").length;

  if (pageCount > 0 && nonWhitespace === 0) {
    warnings.push(
      "No embedded text was found. This is common for scanned documents; OCR is not part of this pipeline.",
    );
  } else if (pageCount > 0 && nonWhitespace < pageCount * MIN_CHARS_PER_PAGE_GUESS) {
    warnings.push(
      "Very little text was extracted relative to page count. The PDF may be scanned, image-heavy, or use unusual encodings.",
    );
  }

  return { text, pageCount, warnings };
}
