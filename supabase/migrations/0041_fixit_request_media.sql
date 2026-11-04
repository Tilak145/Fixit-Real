-- Photos and a short video, sent with the job.
--
-- A one-line description ("sink leaking") makes a professional guess, and a
-- guess costs a wasted trip: they arrive without the part, or find a job that
-- is not the one they priced. A picture answers most of those questions before
-- anyone drives anywhere. This stores the customer's own photos and one short
-- video against the request, and hands them to the professionals who can
-- already see the job, so they can look before they quote.
--
-- Everything here is private. A photo of someone's kitchen is not public
-- content, so the bucket is not public, and a file is readable only through a
-- rule that allows it: the customer on their own request, the professionals who
-- match it, and management. Files live under the request's own id, which is
-- what lets a storage rule ask "may this person see this job" without trusting
-- anything the client sent.
--
-- Attaching media needs an account, because a file has to belong to someone.
-- A signed-out visitor can still send a request; the form tells them plainly
-- that adding photos needs a sign-in rather than failing on submit.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'request-media',
  'request-media',
  false,
  -- 25 MB: comfortably one phone photo or a short clip, nothing larger.
  26214400,
  array[
    'image/jpeg','image/png','image/webp','image/heic','image/heif',
    'video/mp4','video/quicktime','video/webm'
  ]
)
on conflict (id) do nothing;

create table if not exists public.quote_request_media (
  id uuid primary key default gen_random_uuid(),
  quote_request_id uuid not null references public.quote_requests(id) on delete cascade,
  -- Who uploaded it. Kept so an account deletion removes the person's uploads
  -- even if the request outlives them.
  uploaded_by uuid references auth.users(id) on delete cascade,
  kind text not null check (kind in ('photo', 'video')),
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now(),
  -- One file per stored path, so the same upload cannot be recorded twice.
  unique (storage_path)
);

create index if not exists quote_request_media_request_idx
  on public.quote_request_media (quote_request_id, created_at);

alter table public.quote_request_media enable row level security;

-- The customer reads the media on their own request.
drop policy if exists quote_request_media_customer on public.quote_request_media;
create policy quote_request_media_customer on public.quote_request_media
  for select to authenticated
  using (
    exists (
      select 1 from public.quote_requests q
      where q.id = quote_request_id
        and q.customer_user_id = (select auth.uid())
    )
  );

-- A professional reads the media on a job they can see. This is the same rule
-- that decides which leads reach them: their services, their area, and a job
-- that is not already closed. A pro who has been awarded the job keeps it.
drop policy if exists quote_request_media_matching_provider on public.quote_request_media;
create policy quote_request_media_matching_provider on public.quote_request_media
  for select to authenticated
  using (
    exists (
      select 1
      from public.quote_requests q
      join public.providers p on p.auth_user_id = (select auth.uid())
      join public.provider_services s on s.provider_id = p.id and s.category_slug = q.category_slug
      join public.provider_service_areas a on a.provider_id = p.id and a.city = q.city
      where q.id = quote_request_id
        and (p.accepting_work or q.claimed_by = p.id)
    )
  );

-- The customer may add media to, or remove it from, their own request.
drop policy if exists quote_request_media_customer_write on public.quote_request_media;
create policy quote_request_media_customer_write on public.quote_request_media
  for all to authenticated
  using (
    exists (
      select 1 from public.quote_requests q
      where q.id = quote_request_id
        and q.customer_user_id = (select auth.uid())
    )
  )
  with check (
    uploaded_by = (select auth.uid())
    and exists (
      select 1 from public.quote_requests q
      where q.id = quote_request_id
        and q.customer_user_id = (select auth.uid())
    )
  );

drop policy if exists quote_request_media_admin on public.quote_request_media;
create policy quote_request_media_admin on public.quote_request_media
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

grant select, insert, update, delete on public.quote_request_media to authenticated;

-- ---------------------------------------------------------------------------
-- Storage rules. The first path segment is the request id, so a rule can check
-- the job rather than the file name.
-- ---------------------------------------------------------------------------

-- Reading: the owner of the request, or a professional who can see it.
drop policy if exists request_media_read on storage.objects;
create policy request_media_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'request-media'
    and (
      exists (
        select 1 from public.quote_requests q
        where q.id::text = (storage.foldername(name))[1]
          and q.customer_user_id = (select auth.uid())
      )
      or exists (
        select 1
        from public.quote_requests q
        join public.providers p on p.auth_user_id = (select auth.uid())
        join public.provider_services s on s.provider_id = p.id and s.category_slug = q.category_slug
        join public.provider_service_areas a on a.provider_id = p.id and a.city = q.city
        where q.id::text = (storage.foldername(name))[1]
          and (p.accepting_work or q.claimed_by = p.id)
      )
      or (select public.is_admin())
    )
  );

-- Uploading: only the customer on their own request, into that request's folder.
drop policy if exists request_media_insert on storage.objects;
create policy request_media_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'request-media'
    and exists (
      select 1 from public.quote_requests q
      where q.id::text = (storage.foldername(name))[1]
        and q.customer_user_id = (select auth.uid())
    )
  );

-- Deleting: the customer who sent it, so someone can take back a photo.
drop policy if exists request_media_delete on storage.objects;
create policy request_media_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'request-media'
    and (
      exists (
        select 1 from public.quote_requests q
        where q.id::text = (storage.foldername(name))[1]
          and q.customer_user_id = (select auth.uid())
      )
      or (select public.is_admin())
    )
  );
