-- SR App: bucket privat untuk backup otomatis (jalankan di Supabase → SQL Editor)
-- Path objek: {user_id}/{timestamp}.json — setiap pengguna hanya bisa
-- mengakses folder miliknya sendiri.

insert into storage.buckets (id, name, public)
values ('backups', 'backups', false)
on conflict (id) do nothing;

drop policy if exists "backups: own folder read" on storage.objects;
create policy "backups: own folder read" on storage.objects
  for select to authenticated
  using (bucket_id = 'backups' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "backups: own folder insert" on storage.objects;
create policy "backups: own folder insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'backups' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "backups: own folder delete" on storage.objects;
create policy "backups: own folder delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'backups' and (storage.foldername(name))[1] = (select auth.uid())::text);
