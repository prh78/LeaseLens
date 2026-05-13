-- Structured fields from OpenAI /api/analyse pipeline
alter table public.extracted_data add column if not exists conditional_break_clause text;
alter table public.extracted_data add column if not exists ambiguous_language boolean;
alter table public.extracted_data add column if not exists manual_review_recommended boolean;

comment on column public.extracted_data.conditional_break_clause is 'Summary of conditional break provisions, if clearly stated.';
comment on column public.extracted_data.ambiguous_language is 'True when wording is hedged, unclear, or internally inconsistent.';
comment on column public.extracted_data.manual_review_recommended is 'True when a human should verify extracted terms.';
