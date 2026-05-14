-- Supplemental lease documents: one primary per lease + optional related PDFs.

create table public.lease_documents (
  id uuid primary key default gen_random_uuid(),
  lease_id uuid not null references public.leases (id) on delete cascade,
  document_type text not null,
  file_url text,
  upload_date timestamptz not null default now(),
  processing_status text not null default 'pending',
  supersedes_fields jsonb not null default '[]'::jsonb,
  constraint lease_documents_type_check check (
    document_type in (
      'primary_lease',
      'deed_of_variation',
      'lease_extension',
      'side_letter',
      'licence_to_alter',
      'rent_review_memorandum',
      'assignment'
    )
  ),
  constraint lease_documents_processing_check check (
    processing_status in (
      'pending',
      'uploading',
      'extracting_text',
      'analysing',
      'complete',
      'failed'
    )
  ),
  constraint lease_documents_supersedes_is_array check (jsonb_typeof(supersedes_fields) = 'array')
);

comment on table public.lease_documents is 'PDFs linked to a lease (primary + supplemental). supersedes_fields lists extracted_data keys overridden by this document after analyse.';

create unique index lease_documents_one_primary_per_lease
  on public.lease_documents (lease_id)
  where document_type = 'primary_lease';

create index lease_documents_lease_id_idx on public.lease_documents (lease_id);
create index lease_documents_lease_upload_idx on public.lease_documents (lease_id, upload_date);

alter table public.lease_documents enable row level security;

create policy lease_documents_select_own on public.lease_documents
  for select using (
    exists (
      select 1 from public.leases l
      where l.id = lease_documents.lease_id and l.user_id = auth.uid()
    )
  );

create policy lease_documents_insert_own on public.lease_documents
  for insert with check (
    exists (
      select 1 from public.leases l
      where l.id = lease_documents.lease_id and l.user_id = auth.uid()
    )
  );

create policy lease_documents_update_own on public.lease_documents
  for update using (
    exists (
      select 1 from public.leases l
      where l.id = lease_documents.lease_id and l.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.leases l
      where l.id = lease_documents.lease_id and l.user_id = auth.uid()
    )
  );

create policy lease_documents_delete_own on public.lease_documents
  for delete using (
    exists (
      select 1 from public.leases l
      where l.id = lease_documents.lease_id and l.user_id = auth.uid()
    )
  );

-- Backfill primary document for every existing lease (idempotent).
insert into public.lease_documents (lease_id, document_type, file_url, upload_date, processing_status, supersedes_fields)
select
  l.id,
  'primary_lease',
  l.file_url,
  l.upload_date,
  case
    when l.extraction_status = 'uploading' and l.file_url is null then 'uploading'::text
    when l.extraction_status = 'failed' then 'failed'
    when l.extraction_status = 'complete' then 'complete'
    when l.extraction_status in ('extracting', 'analysing', 'calculating_risks') then 'analysing'
    else 'pending'
  end,
  '[]'::jsonb
from public.leases l
where not exists (
  select 1 from public.lease_documents d
  where d.lease_id = l.id and d.document_type = 'primary_lease'
);
