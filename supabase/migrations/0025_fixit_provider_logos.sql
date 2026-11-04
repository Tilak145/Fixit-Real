-- A business logo the professional can actually upload.
--
-- The providers table has always had a logo_url column and the marketplace
-- pages have always rendered whatever it holds, but nothing ever wrote to it:
-- a new pro had no way to put their mark on their listing. This adds a small
-- public bucket for logos - a logo is meant to be seen on the public profile,
-- so unlike the verification documents it is not private - and the storage
-- rules that keep one pro from writing into another's folder.

insert into storage.buckets (id, name, public)
values ('provider-logos', 'provider-logos', true)
on conflict (id) do nothing;

-- Anyone may read a logo, because it is shown on a public profile page.
drop policy if exists provider_logos_public_read on storage.objects;
create policy provider_logos_public_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'provider-logos');

-- Only the signed-in professional may write, and only inside their own folder,
-- which is named by their user id. Nobody can overwrite another business's logo
-- by guessing a path.
drop policy if exists provider_logos_own_write on storage.objects;
create policy provider_logos_own_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'provider-logos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists provider_logos_own_update on storage.objects;
create policy provider_logos_own_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'provider-logos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'provider-logos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists provider_logos_own_delete on storage.objects;
create policy provider_logos_own_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'provider-logos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
