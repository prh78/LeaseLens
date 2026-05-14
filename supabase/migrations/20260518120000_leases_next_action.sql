-- Denormalised next critical action per lease (computed after structured analysis).

alter table public.leases
  add column if not exists next_action_type text;

alter table public.leases
  add column if not exists next_action_date date;

alter table public.leases
  add column if not exists next_action_days_remaining integer;

alter table public.leases
  add column if not exists next_action_urgency text;

comment on column public.leases.next_action_type is 'break_notice_deadline | rent_review | lease_expiry | manual_review (priority tier).';
comment on column public.leases.next_action_date is 'Calendar date of the action (null for manual_review-only).';
comment on column public.leases.next_action_days_remaining is 'UTC calendar days from today to next_action_date; negative if overdue.';
comment on column public.leases.next_action_urgency is 'low | medium | high | critical from proximity to the action date.';

alter table public.leases drop constraint if exists leases_next_action_type_check;
alter table public.leases
  add constraint leases_next_action_type_check check (
    next_action_type is null
    or next_action_type in (
      'break_notice_deadline',
      'rent_review',
      'lease_expiry',
      'manual_review'
    )
  );

alter table public.leases drop constraint if exists leases_next_action_urgency_check;
alter table public.leases
  add constraint leases_next_action_urgency_check check (
    next_action_urgency is null
    or next_action_urgency in ('low', 'medium', 'high', 'critical')
  );

create index if not exists leases_next_action_urgency_idx
  on public.leases (user_id, next_action_urgency)
  where next_action_type is not null;
