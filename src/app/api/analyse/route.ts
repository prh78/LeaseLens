import { Buffer } from "node:buffer";

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { syncLeaseAlerts } from "@/lib/alerts/sync-lease-alerts";
import { syncLeaseNextAction } from "@/lib/lease/sync-lease-next-action";
import { parseBearerFromRequest } from "@/lib/auth/bearer";
import { finalizeLeaseAnalyseOutput, type LeaseAnalyseOutput } from "@/lib/lease/lease-analyse-schema";
import { applyLeaseDateValidationRules } from "@/lib/lease/lease-date-validations";
import { syncBreakClauseStatusWithBreakDates } from "@/lib/lease/break-clause-status";
import {
  buildInitialProvenance,
  mergeSupplementalWithAudit,
  type ChangeHistoryEntry,
  type DocumentConflictEntry,
  type FieldProvenanceEntry,
} from "@/lib/lease/lease-detail-audit";
import { computeLeaseReviewSnapshot } from "@/lib/lease/compute-lease-review-snapshot";
import { parseFieldExtractionMeta, parseDateAmbiguities, parseDateFieldConfidence } from "@/lib/lease/field-extraction-meta";
import { mergeStructuredLeaseFields, parseSupersedesFields } from "@/lib/lease/merge-structured-lease-fields";
import { analyseLeaseTextWithOpenAI } from "@/lib/lease/openai-analyse";
import { sortLeaseDocumentsForExtraction } from "@/lib/lease/sort-lease-documents-for-extraction";
import { extractTextFromPdfBuffer } from "@/lib/pdf/extract-text";
import type { Database, Json } from "@/lib/supabase/database.types";
import { getPublicEnv } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** Vercel / long-running: primary + supplemental can invoke OpenAI multiple times sequentially. */
export const maxDuration = 300;

const MAX_LEASE_TEXT_CHARS = 120_000;

type AnalyseBody = {
  leaseId?: unknown;
  rawText?: unknown;
};

function nullIfEmpty(value: string | null): string | null {
  if (value == null) {
    return null;
  }
  const t = value.trim();
  return t === "" ? null : t;
}

function truncateError(message: string, max = 2000): string {
  if (message.length <= max) {
    return message;
  }
  return `${message.slice(0, max)}…`;
}

/** PostgREST when DB is behind migration `20260521130000_lease_detail_audit_columns.sql`. */
function isMissingExtractedAuditColumnError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("schema cache") ||
    (m.includes("could not find") &&
      (m.includes("change_history") ||
        m.includes("field_provenance") ||
        m.includes("document_conflicts") ||
        m.includes("field_extraction_meta") ||
        m.includes("date_validation_warnings") ||
        m.includes("break_clause_status")))
  );
}

/**
 * POST /api/analyse
 *
 * Body: `{ "leaseId": "<uuid>", "rawText"?: string }`
 * - Loads `extracted_data.raw_text` for the lease unless `rawText` is provided (must still own the lease).
 * - Calls OpenAI with retries until JSON passes Zod schema validation.
 * - Upserts `extracted_data` with structured fields.
 *
 * Auth: `Authorization: Bearer <user access token>`
 * Env: `OPENAI_API_KEY`, optional `OPENAI_MODEL` (default `gpt-4o-mini`)
 */
export async function POST(request: Request) {
  const bearer = parseBearerFromRequest(request);
  if (!bearer) {
    return NextResponse.json({ error: "Missing or invalid Authorization header." }, { status: 401 });
  }

  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = getPublicEnv();

  const authClient = createClient<Database>(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser(bearer);

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: AnalyseBody;
  try {
    body = (await request.json()) as AnalyseBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const leaseId = typeof body.leaseId === "string" ? body.leaseId.trim() : "";
  const rawTextOverride = typeof body.rawText === "string" ? body.rawText : undefined;

  if (!leaseId) {
    return NextResponse.json({ error: "leaseId is required." }, { status: 400 });
  }

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return NextResponse.json(
      {
        error:
          "OPENAI_API_KEY is not set. Add it to .env.local (see .env.example) and restart the dev server.",
      },
      { status: 503 },
    );
  }

  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceRole) {
    return NextResponse.json(
      { error: "Server configuration: set SUPABASE_SERVICE_ROLE_KEY." },
      { status: 503 },
    );
  }

  const admin = createClient<Database>(NEXT_PUBLIC_SUPABASE_URL, serviceRole, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data: lease, error: leaseError } = await admin
    .from("leases")
    .select("id, user_id")
    .eq("id", leaseId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (leaseError) {
    return NextResponse.json({ error: leaseError.message }, { status: 500 });
  }

  if (!lease) {
    return NextResponse.json({ error: "Lease not found." }, { status: 404 });
  }

  const { data: extractedRow, error: extractedErr } = await admin
    .from("extracted_data")
    .select("raw_text, break_clause_status")
    .eq("lease_id", leaseId)
    .maybeSingle();

  if (extractedErr) {
    return NextResponse.json({ error: extractedErr.message }, { status: 500 });
  }

  const textSource = rawTextOverride ?? extractedRow?.raw_text ?? "";
  const trimmed = textSource.trim();

  if (!trimmed) {
    return NextResponse.json(
      { error: "No lease text available. Run PDF extraction first or pass rawText in the request body." },
      { status: 400 },
    );
  }

  const leaseText =
    trimmed.length > MAX_LEASE_TEXT_CHARS ? trimmed.slice(0, MAX_LEASE_TEXT_CHARS) : trimmed;

  let structured: LeaseAnalyseOutput;
  let attemptsUsed: number;
  try {
    const result = await analyseLeaseTextWithOpenAI(leaseText);
    structured = finalizeLeaseAnalyseOutput(result.data);
    attemptsUsed = result.attemptsUsed;
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "OpenAI analyse failed.";
    const safe = truncateError(message);
    await admin
      .from("leases")
      .update({ extraction_status: "failed", extraction_error: safe })
      .eq("id", leaseId)
      .eq("user_id", user.id);
    await admin
      .from("lease_documents")
      .update({ processing_status: "failed" })
      .eq("lease_id", leaseId)
      .eq("processing_status", "analysing");

    try {
      await syncLeaseNextAction(admin, leaseId);
    } catch (syncCause) {
      console.error("syncLeaseNextAction failed:", syncCause);
    }

    return NextResponse.json({ error: message, leaseId }, { status: 502 });
  }

  let mergedStructured = structured;

  const { data: primaryDoc, error: primaryDocErr } = await admin
    .from("lease_documents")
    .select("id, upload_date")
    .eq("lease_id", leaseId)
    .eq("document_type", "primary_lease")
    .maybeSingle();

  if (primaryDocErr) {
    return NextResponse.json({ error: primaryDocErr.message }, { status: 500 });
  }

  const changeAudit: ChangeHistoryEntry[] = [];
  const conflictAudit: DocumentConflictEntry[] = [];
  const provenanceMutable: Record<string, FieldProvenanceEntry> = primaryDoc
    ? { ...(buildInitialProvenance(primaryDoc) as Record<string, FieldProvenanceEntry>) }
    : {};

  const { data: supplementalRows, error: supErr } = await admin
    .from("lease_documents")
    .select("id, document_type, file_url, upload_date, supersedes_fields")
    .eq("lease_id", leaseId)
    .neq("document_type", "primary_lease")
    .not("file_url", "is", null);

  if (!supErr && supplementalRows?.length) {
    const ordered = sortLeaseDocumentsForExtraction(supplementalRows);
    for (const row of ordered) {
      const keys = parseSupersedesFields(row.supersedes_fields);
      if (keys.length === 0 || !row.file_url) {
        continue;
      }

      try {
        const { data: blob, error: dlErr } = await admin.storage.from("leases").download(row.file_url);
        if (dlErr || !blob) {
          throw new Error(dlErr?.message ?? "Supplemental download failed.");
        }
        const buf = Buffer.from(await blob.arrayBuffer());
        const { text: docText } = await extractTextFromPdfBuffer(buf);
        const docTrimmed = docText.trim();
        const slice =
          docTrimmed.length > MAX_LEASE_TEXT_CHARS ? docTrimmed.slice(0, MAX_LEASE_TEXT_CHARS) : docTrimmed;
        const supResult = await analyseLeaseTextWithOpenAI(slice);
        const patch = finalizeLeaseAnalyseOutput(supResult.data);
        if (primaryDoc) {
          mergedStructured = mergeSupplementalWithAudit(mergedStructured, patch, keys, {
            primaryDocumentId: primaryDoc.id,
            supplemental: {
              id: row.id,
              document_type: row.document_type,
              upload_date: row.upload_date,
            },
            provenance: provenanceMutable,
            changeHistory: changeAudit,
            conflicts: conflictAudit,
          });
        } else {
          mergedStructured = mergeStructuredLeaseFields(mergedStructured, patch, keys);
        }
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : "Supplemental analyse failed.";
        const safe = truncateError(message);
        await admin
          .from("leases")
          .update({ extraction_status: "failed", extraction_error: safe })
          .eq("id", leaseId)
          .eq("user_id", user.id);
        await admin
          .from("lease_documents")
          .update({ processing_status: "failed" })
          .eq("lease_id", leaseId)
          .eq("processing_status", "analysing");

        try {
          await syncLeaseNextAction(admin, leaseId);
        } catch (syncCause) {
          console.error("syncLeaseNextAction failed:", syncCause);
        }

        return NextResponse.json({ error: message, leaseId }, { status: 502 });
      }
    }
  }

  if (conflictAudit.length > 0) {
    mergedStructured = {
      ...mergedStructured,
      manual_review_recommended: true,
      ambiguous_language: true,
    };
  }

  mergedStructured = finalizeLeaseAnalyseOutput(mergedStructured);
  const { data: afterDateRules, warnings: dateValidationWarnings } = applyLeaseDateValidationRules(mergedStructured);
  mergedStructured = afterDateRules;

  const breakClauseStatusRecord = syncBreakClauseStatusWithBreakDates(
    mergedStructured.break_dates,
    extractedRow?.break_clause_status ?? null,
  );

  const preservedRaw = extractedRow?.raw_text ?? (rawTextOverride ? rawTextOverride : null);

  const coreUpsertRow: Database["public"]["Tables"]["extracted_data"]["Insert"] = {
    lease_id: leaseId,
    raw_text: preservedRaw,
    term_commencement_date: mergedStructured.term_commencement_date,
    rent_commencement_date: mergedStructured.rent_commencement_date,
    expiry_date: mergedStructured.expiry_date,
    break_dates: mergedStructured.break_dates as unknown as Json,
    break_clause_status: breakClauseStatusRecord as unknown as Json,
    notice_period_days: mergedStructured.notice_period_days,
    rent_review_dates: mergedStructured.rent_review_dates as unknown as Json,
    repairing_obligation: nullIfEmpty(mergedStructured.repairing_obligation),
    service_charge_responsibility: nullIfEmpty(mergedStructured.service_charge_responsibility),
    reinstatement_required: mergedStructured.reinstatement_required,
    vacant_possession_required: mergedStructured.vacant_possession_required,
    conditional_break_clause: nullIfEmpty(mergedStructured.conditional_break_clause),
    ambiguous_language: mergedStructured.ambiguous_language,
    manual_review_recommended: mergedStructured.manual_review_recommended,
    confidence_score: mergedStructured.confidence_score,
    date_field_confidence: mergedStructured.date_field_confidence as unknown as Json,
    date_ambiguities: mergedStructured.date_ambiguities as unknown as Json,
    date_validation_warnings: dateValidationWarnings as unknown as Json,
    source_snippets: mergedStructured.source_snippets as unknown as Json,
    field_extraction_meta: mergedStructured.field_extraction_meta as unknown as Json,
  };

  const fullUpsertRow: Database["public"]["Tables"]["extracted_data"]["Insert"] = {
    ...coreUpsertRow,
    field_provenance: provenanceMutable as unknown as Json,
    change_history: changeAudit as unknown as Json,
    document_conflicts: conflictAudit as unknown as Json,
  };

  let upsertError = (await admin.from("extracted_data").upsert(fullUpsertRow, { onConflict: "lease_id" })).error;

  if (upsertError && isMissingExtractedAuditColumnError(upsertError.message)) {
    console.warn(
      "[analyse] extracted_data audit / explainability columns missing from database; apply migrations 20260521130000 and 20260522120000. Saving structured fields without provenance / change history / conflicts / field_extraction_meta.",
    );
    upsertError = (await admin.from("extracted_data").upsert(coreUpsertRow, { onConflict: "lease_id" })).error;
  }

  if (upsertError) {
    await admin
      .from("leases")
      .update({ extraction_status: "failed", extraction_error: truncateError(upsertError.message) })
      .eq("id", leaseId)
      .eq("user_id", user.id);
    await admin
      .from("lease_documents")
      .update({ processing_status: "failed" })
      .eq("lease_id", leaseId)
      .eq("processing_status", "analysing");

    try {
      await syncLeaseNextAction(admin, leaseId);
    } catch (syncCause) {
      console.error("syncLeaseNextAction failed:", syncCause);
    }

    return NextResponse.json({ error: upsertError.message, leaseId }, { status: 500 });
  }

  const { error: risksPhaseErr } = await admin
    .from("leases")
    .update({ extraction_status: "calculating_risks", extraction_error: null })
    .eq("id", leaseId)
    .eq("user_id", user.id);

  if (risksPhaseErr) {
    return NextResponse.json({ error: risksPhaseErr.message, leaseId }, { status: 500 });
  }

  try {
    await syncLeaseAlerts(admin, leaseId);
  } catch (syncCause) {
    console.error("syncLeaseAlerts failed:", syncCause);
  }

  try {
    await syncLeaseNextAction(admin, leaseId);
  } catch (syncCause) {
    console.error("syncLeaseNextAction failed:", syncCause);
  }

  const fieldMeta = parseFieldExtractionMeta(mergedStructured.field_extraction_meta as Json);
  const dateFieldConfidence = parseDateFieldConfidence(mergedStructured.date_field_confidence as unknown as Json);
  const dateAmbiguities = parseDateAmbiguities(mergedStructured.date_ambiguities as unknown as Json);
  const reviewSnapshot = computeLeaseReviewSnapshot({
    manualReviewRecommended: mergedStructured.manual_review_recommended,
    ambiguousLanguage: mergedStructured.ambiguous_language,
    confidenceScore: mergedStructured.confidence_score,
    documentConflicts: conflictAudit,
    fieldExtractionMeta: fieldMeta,
    dateAmbiguities,
    dateFieldConfidence,
    dateValidationWarnings,
  });

  const { error: leaseDoneErr } = await admin
    .from("leases")
    .update({
      extraction_status: "complete",
      extraction_error: null,
      review_status: reviewSnapshot.review_status,
      review_priority: reviewSnapshot.review_priority,
      review_reason: reviewSnapshot.review_reason,
      review_affected_fields: [...reviewSnapshot.review_affected_fields] as unknown as Json,
    })
    .eq("id", leaseId)
    .eq("user_id", user.id);

  if (leaseDoneErr) {
    return NextResponse.json({ error: leaseDoneErr.message, leaseId }, { status: 500 });
  }

  await admin
    .from("lease_documents")
    .update({ processing_status: "complete" })
    .eq("lease_id", leaseId)
    .eq("processing_status", "analysing");

  return NextResponse.json({
    leaseId,
    attemptsUsed,
    ...mergedStructured,
  });
}
