-- Pipeline: uploading → extracting → analysing → complete | failed
-- Replaces legacy pending / processing.

update public.leases
set extraction_status = 'extracting'
where extraction_status in ('pending', 'processing');

alter table public.leases drop constraint if exists leases_extraction_status_check;

alter table public.leases
  add constraint leases_extraction_status_check check (
    extraction_status in ('uploading', 'extracting', 'analysing', 'complete', 'failed')
  );

comment on column public.leases.extraction_status is 'uploading: row created, file not attached yet. extracting: PDF text. analysing: OpenAI structured. complete: done. failed: extract or analyse error.';
