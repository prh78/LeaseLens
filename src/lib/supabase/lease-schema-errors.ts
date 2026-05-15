/**
 * When the remote DB has not applied `20260517120000_lease_extraction_pipeline_statuses.sql`,
 * inserts/updates using `uploading` / `extracting` / `analysing` fail with this check.
 */
export function leaseExtractionStatusConstraintHint(error: {
  code?: string;
  message?: string;
}): string | null {
  if (error.message?.includes("leases_extraction_status_check")) {
    return (
      "Database is missing the pipeline migration: apply " +
      "supabase/migrations/20260517120000_lease_extraction_pipeline_statuses.sql " +
      "(from the project root run `supabase db push`, or paste that file into the Supabase SQL Editor and run it)."
    );
  }
  if (error.message?.includes("leases_lease_jurisdiction_check")) {
    return (
      "Database is missing the jurisdiction migration: apply " +
      "supabase/migrations/20260527120000_lease_jurisdiction_and_notice_units.sql " +
      "(from the project root run `supabase db push`, or paste that file into the Supabase SQL Editor and run it)."
    );
  }
  return null;
}
