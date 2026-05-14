-- Optional display name per document; provenance / audit / conflicts on extracted_data for lease detail UI.

alter table public.lease_documents
  add column if not exists display_name text;

comment on column public.lease_documents.display_name is 'Optional user-facing label; defaults to document type in UI.';

alter table public.extracted_data
  add column if not exists field_provenance jsonb not null default '{}'::jsonb,
  add column if not exists change_history jsonb not null default '[]'::jsonb,
  add column if not exists document_conflicts jsonb not null default '[]'::jsonb;

comment on column public.extracted_data.field_provenance is 'Map of structured field key -> { source_document_id, source_document_type, source_label, effective_date }.';
comment on column public.extracted_data.change_history is 'Audit trail of field updates from supplemental merges.';
comment on column public.extracted_data.document_conflicts is 'Detected overlapping amendments on the same field.';

alter table public.extracted_data
  add constraint extracted_data_field_provenance_object check (jsonb_typeof(field_provenance) = 'object');

alter table public.extracted_data
  add constraint extracted_data_change_history_array check (jsonb_typeof(change_history) = 'array');

alter table public.extracted_data
  add constraint extracted_data_document_conflicts_array check (jsonb_typeof(document_conflicts) = 'array');
