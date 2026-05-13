-- LeaseLens core schema: leases, extracted_data, alerts
-- Apply with Supabase CLI (recommended):
--   supabase link --project-ref <your-ref>
--   supabase db push
-- Or: Supabase Dashboard → SQL Editor → paste this file → Run.

-- ---------------------------------------------------------------------------
-- leases
-- ---------------------------------------------------------------------------
create table public.leases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  property_name text not null,
  property_type text not null default 'unknown',
  file_url text,
  upload_date timestamptz not null default now(),
  extraction_status text not null default 'pending',
  overall_risk text not null default 'medium',
  constraint leases_extraction_status_check check (
    extraction_status in ('pending', 'processing', 'complete', 'failed')
  ),
  constraint leases_overall_risk_check check (
    overall_risk in ('low', 'medium', 'high', 'critical')
  )
);

comment on table public.leases is 'Lease documents and portfolio rows per user.';

create index leases_user_id_idx on public.leases (user_id);
create index leases_upload_date_idx on public.leases (upload_date desc);
create index leases_extraction_status_idx on public.leases (extraction_status);

-- ---------------------------------------------------------------------------
-- extracted_data (one row per lease)
-- ---------------------------------------------------------------------------
create table public.extracted_data (
  lease_id uuid primary key references public.leases (id) on delete cascade,
  commencement_date date,
  expiry_date date,
  break_dates jsonb not null default '[]'::jsonb,
  notice_period_days integer,
  rent_review_dates jsonb not null default '[]'::jsonb,
  repairing_obligation text,
  service_charge_responsibility text,
  reinstatement_required boolean,
  vacant_possession_required boolean,
  confidence_score numeric(5, 4),
  source_snippets jsonb not null default '{}'::jsonb,
  constraint extracted_data_confidence_score_check check (
    confidence_score is null or (confidence_score >= 0 and confidence_score <= 1)
  )
);

comment on table public.extracted_data is 'Structured fields extracted from lease documents.';

create index extracted_data_expiry_date_idx on public.extracted_data (expiry_date);

-- ---------------------------------------------------------------------------
-- alerts
-- ---------------------------------------------------------------------------
create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  lease_id uuid not null references public.leases (id) on delete cascade,
  alert_type text not null,
  trigger_date timestamptz not null,
  sent_status text not null default 'pending',
  constraint alerts_sent_status_check check (
    sent_status in ('pending', 'sent', 'skipped', 'failed')
  )
);

comment on table public.alerts is 'Scheduled / triggered notifications per lease.';

create index alerts_lease_id_idx on public.alerts (lease_id);
create index alerts_trigger_date_idx on public.alerts (trigger_date);
create index alerts_sent_status_idx on public.alerts (sent_status);

-- ---------------------------------------------------------------------------
-- row level security
-- ---------------------------------------------------------------------------
alter table public.leases enable row level security;
alter table public.extracted_data enable row level security;
alter table public.alerts enable row level security;

-- leases: owner only
create policy leases_select_own on public.leases
  for select using (auth.uid() = user_id);

create policy leases_insert_own on public.leases
  for insert with check (auth.uid() = user_id);

create policy leases_update_own on public.leases
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy leases_delete_own on public.leases
  for delete using (auth.uid() = user_id);

-- extracted_data: via owning lease
create policy extracted_data_select_own on public.extracted_data
  for select using (
    exists (
      select 1 from public.leases l
      where l.id = extracted_data.lease_id and l.user_id = auth.uid()
    )
  );

create policy extracted_data_insert_own on public.extracted_data
  for insert with check (
    exists (
      select 1 from public.leases l
      where l.id = extracted_data.lease_id and l.user_id = auth.uid()
    )
  );

create policy extracted_data_update_own on public.extracted_data
  for update using (
    exists (
      select 1 from public.leases l
      where l.id = extracted_data.lease_id and l.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.leases l
      where l.id = extracted_data.lease_id and l.user_id = auth.uid()
    )
  );

create policy extracted_data_delete_own on public.extracted_data
  for delete using (
    exists (
      select 1 from public.leases l
      where l.id = extracted_data.lease_id and l.user_id = auth.uid()
    )
  );

-- alerts: via owning lease
create policy alerts_select_own on public.alerts
  for select using (
    exists (
      select 1 from public.leases l
      where l.id = alerts.lease_id and l.user_id = auth.uid()
    )
  );

create policy alerts_insert_own on public.alerts
  for insert with check (
    exists (
      select 1 from public.leases l
      where l.id = alerts.lease_id and l.user_id = auth.uid()
    )
  );

create policy alerts_update_own on public.alerts
  for update using (
    exists (
      select 1 from public.leases l
      where l.id = alerts.lease_id and l.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.leases l
      where l.id = alerts.lease_id and l.user_id = auth.uid()
    )
  );

create policy alerts_delete_own on public.alerts
  for delete using (
    exists (
      select 1 from public.leases l
      where l.id = alerts.lease_id and l.user_id = auth.uid()
    )
  );
