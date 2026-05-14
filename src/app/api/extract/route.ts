import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { parseBearerFromRequest } from "@/lib/auth/bearer";
import { sortLeaseDocumentsForExtraction } from "@/lib/lease/sort-lease-documents-for-extraction";
import { extractTextFromPdfBuffer } from "@/lib/pdf/extract-text";
import { syncLeaseNextAction } from "@/lib/lease/sync-lease-next-action";
import type { Database, Json, LeaseDocumentType } from "@/lib/supabase/database.types";
import { getPublicEnv } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Cap JSON body size for very large leases; full text is still stored in Postgres. */
const RESPONSE_TEXT_CHAR_CAP = 400_000;

function truncateForResponse(text: string): { text: string; truncated: boolean; storedLength: number } {
  const storedLength = text.length;
  if (text.length <= RESPONSE_TEXT_CHAR_CAP) {
    return { text, truncated: false, storedLength };
  }
  return {
    text: text.slice(0, RESPONSE_TEXT_CHAR_CAP),
    truncated: true,
    storedLength,
  };
}

function truncateError(message: string, max = 2000): string {
  if (message.length <= max) {
    return message;
  }
  return `${message.slice(0, max)}…`;
}

type ExtractBody = {
  leaseId?: unknown;
  force?: unknown;
};

type DownloadJob = Readonly<{
  storagePath: string;
  documentId: string | null;
  documentType: LeaseDocumentType | "legacy";
}>;

/**
 * POST /api/extract
 *
 * Body: `{ "leaseId": "<uuid>", "force"?: boolean }`
 * Auth: `Authorization: Bearer <user access token>`
 *
 * Downloads all lease PDFs (`lease_documents` in order, primary first; falls back to `leases.file_url`),
 * concatenates extracted text with document markers, upserts `extracted_data.raw_text`,
 * and updates `leases.extraction_status` / `leases.extraction_error`.
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

  let body: ExtractBody;
  try {
    body = (await request.json()) as ExtractBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const leaseId = typeof body.leaseId === "string" ? body.leaseId.trim() : "";
  const force = body.force === true;

  if (!leaseId) {
    return NextResponse.json({ error: "leaseId is required." }, { status: 400 });
  }

  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceRole) {
    return NextResponse.json(
      {
        error:
          "Server configuration: set SUPABASE_SERVICE_ROLE_KEY (see Supabase Dashboard → Settings → API).",
      },
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
    .select("id, user_id, file_url, extraction_status")
    .eq("id", leaseId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (leaseError) {
    return NextResponse.json({ error: leaseError.message }, { status: 500 });
  }

  if (!lease) {
    return NextResponse.json({ error: "Lease not found." }, { status: 404 });
  }

  if (lease.extraction_status === "uploading") {
    return NextResponse.json({ error: "Lease file is not attached yet." }, { status: 400 });
  }

  if (!force && lease.extraction_status === "failed") {
    return NextResponse.json(
      { error: "Extraction previously failed. Pass force: true to retry.", leaseId },
      { status: 409 },
    );
  }

  const cacheableAfterText =
    lease.extraction_status === "complete" ||
    lease.extraction_status === "analysing" ||
    lease.extraction_status === "calculating_risks";

  if (!force && cacheableAfterText) {
    const { data: existingRow, error: existingErr } = await admin
      .from("extracted_data")
      .select("raw_text")
      .eq("lease_id", leaseId)
      .maybeSingle();

    if (existingErr) {
      return NextResponse.json({ error: existingErr.message }, { status: 500 });
    }

    const cached = existingRow?.raw_text;
    if (typeof cached === "string" && cached.length > 0) {
      const { text, truncated, storedLength } = truncateForResponse(cached);
      return NextResponse.json({
        leaseId,
        extractionStatus: lease.extraction_status,
        text,
        textTruncatedInResponse: truncated,
        storedCharacterCount: storedLength,
        pageCount: null,
        warnings: [],
        fromCache: true,
      });
    }
  }

  if (!force && lease.extraction_status !== "extracting") {
    return NextResponse.json(
      { error: `Cannot extract while status is ${lease.extraction_status}.` },
      { status: 409 },
    );
  }

  const { data: docRows, error: docsErr } = await admin
    .from("lease_documents")
    .select("id, document_type, file_url, upload_date")
    .eq("lease_id", leaseId);

  if (docsErr) {
    return NextResponse.json({ error: docsErr.message }, { status: 500 });
  }

  const sortedDocs = sortLeaseDocumentsForExtraction(docRows ?? []);
  const jobs: DownloadJob[] = [];
  for (const d of sortedDocs) {
    const path = d.file_url?.trim();
    if (path) {
      jobs.push({
        storagePath: path,
        documentId: d.id,
        documentType: d.document_type,
      });
    }
  }

  if (jobs.length === 0 && lease.file_url) {
    jobs.push({ storagePath: lease.file_url, documentId: null, documentType: "legacy" });
  }

  if (jobs.length === 0) {
    return NextResponse.json({ error: "This lease has no files in storage." }, { status: 400 });
  }

  const activeRowIds = jobs.map((j) => j.documentId).filter((id): id is string => id != null);

  if (activeRowIds.length > 0) {
    await admin
      .from("lease_documents")
      .update({ processing_status: "extracting_text" })
      .in("id", activeRowIds);
  }

  try {
    const textSections: string[] = [];
    const allWarnings: string[] = [];
    let totalPages = 0;

    for (const job of jobs) {
      const { data: blob, error: downloadError } = await admin.storage.from("leases").download(job.storagePath);

      if (downloadError || !blob) {
        const msg = downloadError?.message ?? "Download failed.";
        await admin
          .from("leases")
          .update({ extraction_status: "failed", extraction_error: truncateError(msg) })
          .eq("id", leaseId)
          .eq("user_id", user.id);
        if (activeRowIds.length > 0) {
          await admin.from("lease_documents").update({ processing_status: "failed" }).in("id", activeRowIds);
        }
        try {
          await syncLeaseNextAction(admin, leaseId);
        } catch (syncCause) {
          console.error("syncLeaseNextAction failed:", syncCause);
        }
        return NextResponse.json({ error: msg, leaseId, extractionStatus: "failed" as const }, { status: 502 });
      }

      const arrayBuffer = await blob.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const { text: fullText, pageCount, warnings } = await extractTextFromPdfBuffer(buffer);
      if (pageCount != null) {
        totalPages += pageCount;
      }
      allWarnings.push(...warnings);

      if (job.documentId != null) {
        textSections.push(
          `\n\n--- BEGIN DOCUMENT ${job.documentId} [${job.documentType}] ---\n\n${fullText}\n\n--- END DOCUMENT ${job.documentId} ---\n`,
        );
      } else {
        textSections.push(`\n\n--- BEGIN LEGACY LEASE FILE ---\n\n${fullText}\n\n--- END LEGACY LEASE FILE ---\n`);
      }
    }

    const mergedText = textSections.join("").trimStart();

    const insertPayload: Database["public"]["Tables"]["extracted_data"]["Insert"] = {
      lease_id: leaseId,
      raw_text: mergedText,
      break_dates: [] as unknown as Json,
      rent_review_dates: [] as unknown as Json,
      source_snippets: {} as Json,
    };
    const { error: insErr } = await admin.from("extracted_data").insert(insertPayload);
    const duplicateKey =
      insErr?.code === "23505" ||
      (typeof insErr?.message === "string" && insErr.message.toLowerCase().includes("duplicate key"));
    if (insErr && duplicateKey) {
      const { error: upErr } = await admin.from("extracted_data").update({ raw_text: mergedText }).eq("lease_id", leaseId);
      if (upErr) {
        throw new Error(upErr.message);
      }
    } else if (insErr) {
      throw new Error(insErr.message);
    }

    const { error: doneErr } = await admin
      .from("leases")
      .update({ extraction_status: "analysing", extraction_error: null })
      .eq("id", leaseId)
      .eq("user_id", user.id);

    if (doneErr) {
      throw new Error(doneErr.message);
    }

    if (activeRowIds.length > 0) {
      await admin.from("lease_documents").update({ processing_status: "analysing" }).in("id", activeRowIds);
    }

    try {
      await syncLeaseNextAction(admin, leaseId);
    } catch (syncCause) {
      console.error("syncLeaseNextAction failed:", syncCause);
    }

    const { text, truncated, storedLength } = truncateForResponse(mergedText);

    return NextResponse.json({
      leaseId,
      extractionStatus: "analysing" as const,
      text,
      textTruncatedInResponse: truncated,
      storedCharacterCount: storedLength,
      pageCount: totalPages > 0 ? totalPages : null,
      warnings: allWarnings,
      fromCache: false,
      documentsProcessed: jobs.length,
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Extraction failed.";
    const safe = truncateError(message);

    await admin
      .from("leases")
      .update({ extraction_status: "failed", extraction_error: safe })
      .eq("id", leaseId)
      .eq("user_id", user.id);

    if (activeRowIds.length > 0) {
      await admin.from("lease_documents").update({ processing_status: "failed" }).in("id", activeRowIds);
    }

    try {
      await syncLeaseNextAction(admin, leaseId);
    } catch (syncCause) {
      console.error("syncLeaseNextAction failed:", syncCause);
    }

    return NextResponse.json({ error: safe, leaseId, extractionStatus: "failed" as const }, { status: 500 });
  }
}
