-- Per-user notification preferences (alert categories, reminder horizons, digest cadence).

create table public.user_notification_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  alert_categories jsonb not null default '{"expiry": true, "break": true, "rent_review": true}'::jsonb,
  reminder_horizons_days integer[] not null default array[180, 90, 30, 7]::integer[],
  email_digest_frequency text not null default 'off',
  updated_at timestamptz not null default now(),
  constraint user_notification_settings_digest_check check (
    email_digest_frequency in ('off', 'daily', 'weekly', 'monthly')
  ),
  constraint user_notification_settings_horizons_nonempty check (
    array_length(reminder_horizons_days, 1) is not null
    and array_length(reminder_horizons_days, 1) >= 1
  )
);

comment on table public.user_notification_settings is
  'Per-user email notification preferences: which alert kinds to schedule, reminder lead times, digest cadence.';

comment on column public.user_notification_settings.alert_categories is
  'JSON object: expiry, break, rent_review -> boolean enabled.';

comment on column public.user_notification_settings.reminder_horizons_days is
  'Lead times (days before event) for scheduled alerts; values should be chosen from the app allowlist.';

comment on column public.user_notification_settings.email_digest_frequency is
  'Portfolio digest email cadence: off | daily | weekly | monthly (digest delivery is app-specific).';

create index user_notification_settings_updated_at_idx
  on public.user_notification_settings (updated_at desc);

alter table public.user_notification_settings enable row level security;

create policy "Users select own notification settings"
  on public.user_notification_settings
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users insert own notification settings"
  on public.user_notification_settings
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users update own notification settings"
  on public.user_notification_settings
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users delete own notification settings"
  on public.user_notification_settings
  for delete
  to authenticated
  using (auth.uid() = user_id);
