-- Private bucket for lease PDFs; objects live under `{auth.uid()}/...`.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'leases',
  'leases',
  false,
  52428800,
  array['application/pdf']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Objects: first path segment must match the authenticated user id.
drop policy if exists leases_storage_insert_own_prefix on storage.objects;
drop policy if exists leases_storage_select_own_prefix on storage.objects;
drop policy if exists leases_storage_update_own_prefix on storage.objects;
drop policy if exists leases_storage_delete_own_prefix on storage.objects;

create policy leases_storage_insert_own_prefix on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'leases'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy leases_storage_select_own_prefix on storage.objects
  for select to authenticated
  using (
    bucket_id = 'leases'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy leases_storage_update_own_prefix on storage.objects
  for update to authenticated
  using (
    bucket_id = 'leases'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'leases'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy leases_storage_delete_own_prefix on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'leases'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
