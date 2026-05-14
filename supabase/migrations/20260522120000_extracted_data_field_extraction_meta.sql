-- Per-field extraction explainability (confidence, clause reference, rationale) from structured analyse.

alter table public.extracted_data
  add column if not exists field_extraction_meta jsonb not null default '{}'::jsonb;

comment on column public.extracted_data.field_extraction_meta is
  'Map of structured field key -> { confidence?, rationale?, clause_reference? } for legal-review explainability.';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'extracted_data_field_extraction_meta_object'
  ) then
    alter table public.extracted_data
      add constraint extracted_data_field_extraction_meta_object
      check (jsonb_typeof(field_extraction_meta) = 'object');
  end if;
end $$;
