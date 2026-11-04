-- The onboarding wizard has always shown "Insurance Certificate" and "Photo ID"
-- upload buttons, but they were decoration: no file input, no storage, nothing
-- saved. This adds the missing piece - a private bucket and a table of what was
-- uploaded - so the reviewer can actually open the documents an applicant sent.
--
-- Files are private. Nothing here is publicly readable: a professional sees
-- their own, and management sees all of them. The account-deletion function
-- already clears each user's folder in every bucket, so these files go with the
-- account.

insert into storage.buckets (id, name, public)
values ('provider-documents', 'provider-documents', false)
on conflict (id) do nothing;

create table if not exists public.provider_documents (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('photo_id', 'insurance')),
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_at timestamptz not null default now(),
  -- One file per slot: re-uploading replaces the previous one.
  unique (auth_user_id, kind)
);

alter table public.provider_documents enable row level security;

drop policy if exists provider_documents_own on public.provider_documents;
create policy provider_documents_own on public.provider_documents
  for all to authenticated
  using (auth_user_id = (select auth.uid()))
  with check (auth_user_id = (select auth.uid()));

drop policy if exists provider_documents_admin on public.provider_documents;
create policy provider_documents_admin on public.provider_documents
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

grant select, insert, update, delete on public.provider_documents to authenticated;

-- Storage rules. Each file lives under the uploader's own user id, so the
-- folder name is the ownership check: nobody can read or overwrite another
-- person's documents by guessing a path.
drop policy if exists provider_documents_storage_own on storage.objects;
create policy provider_documents_storage_own on storage.objects
  for all to authenticated
  using (
    bucket_id = 'provider-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'provider-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Management reads the documents it is asked to review (a signed link is only
-- issued to someone the storage rules let read the object).
drop policy if exists provider_documents_storage_admin on storage.objects;
create policy provider_documents_storage_admin on storage.objects
  for select to authenticated
  using (
    bucket_id = 'provider-documents'
    and (select public.is_admin())
  );
