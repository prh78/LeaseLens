-- Manual review workflow: queue fields on leases for dashboard + verification status.

alter table public.leases
  add column if not exists review_status text not null default 'not_required';

alter table public.leases
  add column if not exists review_priority text;

alter table public.leases
  add column if not exists review_reason text;

alter table public.leases
  add column if not exists review_affected_fields jsonb not null default '[]'::jsonb;

comment on column public.leases.review_status is 'Verification: not_required | needs_review | verified | unresolved.';
comment on column public.leases.review_priority is 'Queue ordering: low | medium | high when needs_review.';
comment on column public.leases.review_reason is 'Human-readable summary for reviewers (low confidence, conflicts, etc.).';
comment on column public.leases.review_affected_fields is 'JSON array of structured field keys (or labels) requiring attention.';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'leases_review_status_check') then
    alter table public.leases
      add constraint leases_review_status_check
      check (review_status in ('not_required', 'needs_review', 'verified', 'unresolved'));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'leases_review_priority_check') then
    alter table public.leases
      add constraint leases_review_priority_check
      check (review_priority is null or review_priority in ('low', 'medium', 'high'));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'leases_review_affected_fields_array_check') then
    alter table public.leases
      add constraint leases_review_affected_fields_array_check
      check (jsonb_typeof(review_affected_fields) = 'array');
  end if;
end $$;
