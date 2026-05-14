-- Distinct phase after structured upsert while alerts / next-action are synced.

alter table public.leases drop constraint if exists leases_extraction_status_check;

alter table public.leases
  add constraint leases_extraction_status_check check (
    extraction_status in (
      'uploading',
      'extracting',
      'analysing',
      'calculating_risks',
      'complete',
      'failed'
    )
  );

comment on column public.leases.extraction_status is
  'uploading: PDF attaching. extracting: PDF text. analysing: OpenAI structured upsert. calculating_risks: syncing alerts and next-action. complete: done. failed: error.';
