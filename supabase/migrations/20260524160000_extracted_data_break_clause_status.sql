-- Per break-date decision workflow (available | under_review | intend_to_exercise | do_not_exercise | expired).

alter table public.extracted_data
  add column if not exists break_clause_status jsonb not null default '{}'::jsonb;

comment on column public.extracted_data.break_clause_status is
  'Map of ISO break date -> workflow status; keys must match break_dates entries.';

update public.extracted_data ed
set break_clause_status = (
  select coalesce(jsonb_object_agg(t.d::text, to_jsonb('available'::text)), '{}'::jsonb)
  from jsonb_array_elements_text(coalesce(ed.break_dates, '[]'::jsonb)) as t(d)
)
where ed.break_clause_status = '{}'::jsonb
  and jsonb_typeof(coalesce(ed.break_dates, '[]'::jsonb)) = 'array'
  and jsonb_array_length(coalesce(ed.break_dates, '[]'::jsonb)) > 0;
