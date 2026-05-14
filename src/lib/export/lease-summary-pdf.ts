import { PDFDocument, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";

import { formatNextActionDueLabel } from "@/lib/lease/format-next-action-due-label";
import { LEASE_NEXT_ACTION_LABEL, type LeaseNextActionResult } from "@/lib/lease/compute-lease-next-action";
import { confidenceBand, effectiveFieldConfidence, parseFieldExtractionMeta, parseDateFieldConfidence } from "@/lib/lease/field-extraction-meta";
import {
  OPERATIVE_TERMS_CRITICAL_FIELDS,
  OPERATIVE_TERMS_OBLIGATION_FIELDS,
  OPERATIVE_TERMS_OTHER_FIELDS,
  formatOperativeFieldPlain,
} from "@/lib/lease/format-operative-field-value";
import { operativeFieldLabel } from "@/lib/lease/lease-field-labels";
import { parseDocumentConflicts } from "@/lib/lease/lease-detail-json";
import { collectLeaseRiskFlags } from "@/lib/lease/lease-summary-risk-flags";
import { PROPERTY_TYPES } from "@/lib/lease/property-types";
import type { LeaseReviewStatus, Tables } from "@/lib/supabase/database.types";

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 52;
const LINE_HEIGHT = 13;
const FONT_SIZE = 10;
const TITLE_SIZE = 18;

function asciiSafe(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\u2013|\u2014/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"');
}

function propertyTypeLabel(value: string): string {
  return PROPERTY_TYPES.find((p) => p.value === value)?.label ?? value;
}

function verificationLabel(status: LeaseReviewStatus): string {
  const map: Record<LeaseReviewStatus, string> = {
    not_required: "Verification not required",
    needs_review: "Needs review",
    verified: "Verified",
    unresolved: "Unresolved",
  };
  return map[status];
}

function confidenceBandLabel(field: string, extracted: Tables<"extracted_data">): string {
  const meta = parseFieldExtractionMeta(extracted.field_extraction_meta);
  const dateFc = parseDateFieldConfidence(extracted.date_field_confidence);
  const eff = effectiveFieldConfidence(field, meta, extracted.confidence_score, dateFc);
  const band = confidenceBand(eff);
  const labels: Record<typeof band, string> = {
    high: "High confidence",
    medium: "Moderate confidence",
    low: "Low confidence",
    unrated: "Confidence n/a",
  };
  return labels[band];
}

function wrapLines(text: string, font: PDFFont, maxWidth: number, fontSize: number): string[] {
  const normalized = asciiSafe(text).trim();
  if (!normalized) {
    return [""];
  }
  const words = normalized.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    const trial = current ? `${current} ${w}` : w;
    if (font.widthOfTextAtSize(trial, fontSize) <= maxWidth) {
      current = trial;
      continue;
    }
    if (current) {
      lines.push(current);
    }
    if (font.widthOfTextAtSize(w, fontSize) <= maxWidth) {
      current = w;
    } else {
      let chunk = "";
      for (const ch of w) {
        const t2 = chunk + ch;
        if (font.widthOfTextAtSize(t2, fontSize) > maxWidth && chunk) {
          lines.push(chunk);
          chunk = ch;
        } else {
          chunk = t2;
        }
      }
      current = chunk;
    }
  }
  if (current) {
    lines.push(current);
  }
  return lines.length ? lines : [""];
}

class PdfWriter {
  private page: PDFPage;
  private y = PAGE_H - MARGIN;

  constructor(
    private readonly pdfDoc: PDFDocument,
    private readonly font: PDFFont,
    private readonly fontBold: PDFFont,
    private readonly contentWidth: number,
  ) {
    this.page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  }

  private newPage(): void {
    this.page = this.pdfDoc.addPage([PAGE_W, PAGE_H]);
    this.y = PAGE_H - MARGIN;
  }

  private ensureSpace(lines: number): void {
    const need = lines * LINE_HEIGHT + MARGIN;
    if (this.y < need) {
      this.newPage();
    }
  }

  title(text: string): void {
    const safe = asciiSafe(text);
    this.ensureSpace(3);
    this.page.drawText(safe, {
      x: MARGIN,
      y: this.y,
      size: TITLE_SIZE,
      font: this.fontBold,
    });
    this.y -= LINE_HEIGHT * 2.2;
  }

  heading(text: string): void {
    const safe = asciiSafe(text);
    this.ensureSpace(2);
    this.page.drawText(safe, {
      x: MARGIN,
      y: this.y,
      size: 12,
      font: this.fontBold,
    });
    this.y -= LINE_HEIGHT * 1.6;
  }

  paragraph(text: string, size = FONT_SIZE): void {
    const lines = wrapLines(text, this.font, this.contentWidth, size);
    this.ensureSpace(lines.length + 1);
    for (const line of lines) {
      this.page.drawText(line, {
        x: MARGIN,
        y: this.y,
        size,
        font: this.font,
      });
      this.y -= LINE_HEIGHT;
    }
    this.y -= 4;
  }

  keyValue(key: string, value: string): void {
    this.ensureSpace(2);
    this.page.drawText(`${asciiSafe(key)}:`, {
      x: MARGIN,
      y: this.y,
      size: FONT_SIZE,
      font: this.fontBold,
    });
    this.y -= LINE_HEIGHT;
    const lines = wrapLines(value, this.font, this.contentWidth - 12, FONT_SIZE);
    this.ensureSpace(lines.length);
    for (const line of lines) {
      this.page.drawText(line, { x: MARGIN + 12, y: this.y, size: FONT_SIZE, font: this.font });
      this.y -= LINE_HEIGHT;
    }
    this.y -= 4;
  }

  spacer(): void {
    this.y -= LINE_HEIGHT * 0.5;
  }
}

function renderOperativeBlock(
  w: PdfWriter,
  title: string,
  fields: readonly string[],
  extracted: Tables<"extracted_data">,
): void {
  w.heading(title);
  for (const field of fields) {
    const label = operativeFieldLabel(field);
    const value = formatOperativeFieldPlain(field, extracted);
    const conf = confidenceBandLabel(field, extracted);
    w.keyValue(`${label} (${conf})`, value);
  }
  w.spacer();
}

export async function buildLeaseSummaryPdfBytes(input: Readonly<{
  lease: Tables<"leases">;
  extracted: Tables<"extracted_data"> | null;
  nextAction: LeaseNextActionResult | null;
}>): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const contentWidth = PAGE_W - MARGIN * 2;
  const w = new PdfWriter(pdfDoc, font, fontBold, contentWidth);

  const { lease, extracted, nextAction } = input;
  const uploadLabel = new Date(lease.upload_date).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  w.title("Lease summary report");
  w.paragraph(
    `Generated ${new Date().toISOString().slice(0, 10)} (UTC date). This export is for workflow support only and is not legal advice.`,
  );

  w.heading("Property");
  w.keyValue("Name", lease.property_name);
  w.keyValue("Property type", propertyTypeLabel(lease.property_type));
  w.keyValue("Uploaded", uploadLabel);
  w.keyValue("Lease record id", lease.id);

  w.heading("Portfolio signals");
  w.keyValue("Extraction status", lease.extraction_status);
  w.keyValue("Overall risk", lease.overall_risk);
  w.keyValue("Verification status", verificationLabel(lease.review_status));

  w.heading("Next critical action");
  if (nextAction) {
    w.keyValue("Action", LEASE_NEXT_ACTION_LABEL[nextAction.action_type]);
    w.keyValue("Due", formatNextActionDueLabel(nextAction));
    w.keyValue("Action date", nextAction.action_date ?? "—");
    w.keyValue("Urgency", nextAction.urgency_level);
  } else {
    w.paragraph("No next critical action could be derived for this lease.");
  }

  const conflicts = extracted ? parseDocumentConflicts(extracted.document_conflicts) : [];
  const flags = collectLeaseRiskFlags(extracted, conflicts);
  w.heading("Risk flags");
  if (flags.length === 0) {
    w.paragraph("No automated risk flags recorded.");
  } else {
    for (const f of flags) {
      const body = f.detail ? `${f.title} — ${f.detail}` : f.title;
      w.paragraph(`• ${body} (${f.badge} severity)`);
    }
  }

  w.heading("Operative terms (structured extraction)");
  if (!extracted) {
    w.paragraph("No extracted data available for this lease.");
  } else {
    renderOperativeBlock(w, "Critical dates", OPERATIVE_TERMS_CRITICAL_FIELDS, extracted);
    renderOperativeBlock(w, "Obligations", OPERATIVE_TERMS_OBLIGATION_FIELDS, extracted);
    renderOperativeBlock(w, "Other provisions", OPERATIVE_TERMS_OTHER_FIELDS, extracted);
    if (extracted.confidence_score != null) {
      const pct = Math.round(Math.min(1, Math.max(0, extracted.confidence_score)) * 100);
      w.keyValue("Overall model confidence", `${pct}%`);
    }
  }

  return pdfDoc.save();
}
