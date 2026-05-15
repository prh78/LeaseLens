-- SKETCH: international lease metadata + structured notice period.
-- Apply when ready; backfills existing rows to UK defaults.

-- ---------------------------------------------------------------------------
-- leases: jurisdiction drives analyse prompt + UI terminology pack
-- ---------------------------------------------------------------------------
alter table public.leases
  add column if not exists lease_jurisdiction text not null default 'uk';

comment on column public.leases.lease_jurisdiction is
  'Region pack: uk | us | eu | apac | other. Drives extraction prompt addendum and UI labels.';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'leases_lease_jurisdiction_check'
  ) then
    alter table public.leases
      add constraint leases_lease_jurisdiction_check
      check (lease_jurisdiction in ('uk', 'us', 'eu', 'apac', 'other'));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- extracted_data: governing law / currency from document; notice as stated in lease
-- ---------------------------------------------------------------------------
alter table public.extracted_data
  add column if not exists governing_law text,
  add column if not exists premises_country char(2),
  add column if not exists rent_currency char(3),
  add column if not exists notice_period_spec jsonb;

comment on column public.extracted_data.governing_law is
  'Governing law / jurisdiction clause as stated in the lease (verbatim summary), e.g. England and Wales.';

comment on column public.extracted_data.premises_country is
  'ISO 3166-1 alpha-2 country of premises when clear from the lease.';

comment on column public.extracted_data.rent_currency is
  'ISO 4217 currency code for rent when clear (GBP, USD, EUR, …).';

comment on column public.extracted_data.notice_period_spec is
  'Structured notice as extracted: { value, unit, day_basis, anchor, source_text }. '
  'notice_period_days remains the normalised calendar-day count for dashboards when conversion is confident.';

-- Example notice_period_spec:
-- {
--   "value": 6,
--   "unit": "months",
--   "day_basis": "calendar",
--   "anchor": "before_break_date",
--   "source_text": "not less than six months prior to the Break Date"
-- }

-- ---------------------------------------------------------------------------
-- user_notification_settings (optional phase 1b): display locale for dates
-- ---------------------------------------------------------------------------
alter table public.user_notification_settings
  add column if not exists display_locale text not null default 'en-GB';

comment on column public.user_notification_settings.display_locale is
  'BCP 47 locale for date formatting in emails/UI exports (en-GB, en-US, …).';
