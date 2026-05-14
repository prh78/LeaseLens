-- Classify commercial lease dates: term vs rent commencement, rent reviews; optional ambiguity audit + per-date confidence.

alter table public.extracted_data
  add column if not exists term_commencement_date date;

alter table public.extracted_data
  add column if not exists rent_commencement_date date;

alter table public.extracted_data
  add column if not exists date_field_confidence jsonb;

alter table public.extracted_data
  add column if not exists date_ambiguities jsonb not null default '[]'::jsonb;

comment on column public.extracted_data.term_commencement_date is
  'Legal start of the lease term (used with expiry for term calculations).';

comment on column public.extracted_data.rent_commencement_date is
  'Date rental payment obligations begin (may differ from term commencement).';

comment on column public.extracted_data.date_field_confidence is
  'Optional map: term_commencement_date, rent_commencement_date, rent_review_dates -> 0..1 or null.';

comment on column public.extracted_data.date_ambiguities is
  'JSON array of { code, detail } when date wording is ambiguous or conflicting.';

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'extracted_data'
      and column_name = 'commencement_date'
  ) then
    update public.extracted_data
    set term_commencement_date = commencement_date
    where term_commencement_date is null
      and commencement_date is not null;

    alter table public.extracted_data drop column commencement_date;
  end if;
end $$;
