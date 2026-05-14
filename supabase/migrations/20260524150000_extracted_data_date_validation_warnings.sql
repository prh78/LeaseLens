-- Persisted server-side lease date consistency checks (set on each successful analyse).

alter table public.extracted_data
  add column if not exists date_validation_warnings jsonb not null default '[]'::jsonb;

comment on column public.extracted_data.date_validation_warnings is
  'JSON array of { code, message } from deterministic date rules; may set manual_review_recommended on analyse.';
