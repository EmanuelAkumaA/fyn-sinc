
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'client-logos',
  'client-logos',
  true,
  2097152,
  array['image/png','image/jpeg','image/jpg','image/webp','image/svg+xml','image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "client-logos public read"
on storage.objects for select
using (bucket_id = 'client-logos');

create policy "client-logos org members insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'client-logos'
  and public.is_org_member(((storage.foldername(name))[1])::uuid)
);

create policy "client-logos org members update"
on storage.objects for update to authenticated
using (
  bucket_id = 'client-logos'
  and public.is_org_member(((storage.foldername(name))[1])::uuid)
);

create policy "client-logos org members delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'client-logos'
  and public.is_org_member(((storage.foldername(name))[1])::uuid)
);
