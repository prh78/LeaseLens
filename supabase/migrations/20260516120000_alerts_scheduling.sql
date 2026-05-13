-- Alert scheduling: tie each row to a lease milestone + reminder horizon (days before).

alter table public.alerts
  add column if not exists event_kind text;

alter table public.alerts
  add column if not exists event_date date;

alter table public.alerts
  add column if not exists horizon_days integer;

comment on column public.alerts.event_kind is 'expiry | break | rent_review';
comment on column public.alerts.event_date is 'The lease milestone date (UTC calendar day).';
comment on column public.alerts.horizon_days is 'Days before event_date when this reminder becomes due (180, 90, 30, or 7).';

alter table public.alerts drop constraint if exists alerts_event_kind_check;
alter table public.alerts
  add constraint alerts_event_kind_check check (
    event_kind is null or event_kind in ('expiry', 'break', 'rent_review')
  );

alter table public.alerts drop constraint if exists alerts_horizon_days_check;
alter table public.alerts
  add constraint alerts_horizon_days_check check (
    horizon_days is null or horizon_days in (7, 30, 90, 180)
  );

create unique index if not exists alerts_scheduling_uidx
  on public.alerts (lease_id, event_kind, event_date, horizon_days)
  where event_kind is not null and event_date is not null and horizon_days is not null;
