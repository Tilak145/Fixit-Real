-- Tells a professional what FixIt decided about their business: license,
-- insurance, business registration and approval. One notice is written the
-- moment the decision is saved, whichever screen or function saved it, and the
-- pro's dashboard picks it up within a few seconds.

create table if not exists public.provider_notices (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers (id) on delete cascade,
  kind text not null check (kind in ('license', 'insurance', 'registration', 'approval')),
  tone text not null check (tone in ('good', 'bad', 'info')),
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists provider_notices_provider_idx on public.provider_notices (provider_id, created_at desc);

alter table public.provider_notices enable row level security;
revoke all on table public.provider_notices from anon, authenticated;
-- A pro reads their own notices and may only mark them as read. Nobody writes
-- one from a browser; the trigger below does.
grant select on table public.provider_notices to authenticated;
grant update (read_at) on table public.provider_notices to authenticated;

drop policy if exists "notices: a pro reads their own" on public.provider_notices;
create policy "notices: a pro reads their own" on public.provider_notices
  for select to authenticated
  using (exists (select 1 from public.providers p where p.id = provider_id and p.auth_user_id = (select auth.uid())));

drop policy if exists "notices: a pro marks their own read" on public.provider_notices;
create policy "notices: a pro marks their own read" on public.provider_notices
  for update to authenticated
  using (exists (select 1 from public.providers p where p.id = provider_id and p.auth_user_id = (select auth.uid())))
  with check (exists (select 1 from public.providers p where p.id = provider_id and p.auth_user_id = (select auth.uid())));

create or replace function public.write_provider_notices()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- A reset caused by the pro editing their own details is not our decision.
  by_owner boolean := (select auth.uid()) is not distinct from new.auth_user_id and new.auth_user_id is not null;
begin
  if new.license_status is distinct from old.license_status then
    if new.license_status = 'lookup_verified' then
      insert into public.provider_notices (provider_id, kind, tone, title, body)
      values (new.id, 'license', 'good', 'Your license was approved', 'FixIt checked your license and confirmed it.');
    elsif new.license_status = 'lookup_failed' then
      insert into public.provider_notices (provider_id, kind, tone, title, body)
      values (new.id, 'license', 'bad', 'We could not confirm your license', 'Check the license number and state on your profile, or contact FixIt support.');
    elsif old.license_status = 'lookup_verified' and not by_owner then
      insert into public.provider_notices (provider_id, kind, tone, title, body)
      values (new.id, 'license', 'info', 'Your license verification was removed', 'FixIt will need to check your license again.');
    end if;
  end if;

  if new.insurance_status is distinct from old.insurance_status then
    if new.insurance_status = 'verified' then
      insert into public.provider_notices (provider_id, kind, tone, title, body)
      values (new.id, 'insurance', 'good', 'Your insurance was verified', 'FixIt checked your insurance and confirmed it.');
    elsif new.insurance_status = 'rejected' then
      insert into public.provider_notices (provider_id, kind, tone, title, body)
      values (new.id, 'insurance', 'bad', 'Your insurance was not accepted', 'Upload a current insurance certificate, or contact FixIt support.');
    elsif old.insurance_status = 'verified' and not by_owner then
      insert into public.provider_notices (provider_id, kind, tone, title, body)
      values (new.id, 'insurance', 'info', 'Your insurance verification was removed', 'FixIt will need to check your insurance again.');
    end if;
  end if;

  if new.business_registration_status is distinct from old.business_registration_status then
    if new.business_registration_status = 'confirmed' then
      insert into public.provider_notices (provider_id, kind, tone, title, body)
      values (new.id, 'registration', 'good', 'Your business registration was approved', 'FixIt confirmed your business registration.');
    elsif new.business_registration_status = 'not_found' then
      insert into public.provider_notices (provider_id, kind, tone, title, body)
      values (new.id, 'registration', 'bad', 'Your business registration was not found', 'Check the registration number on your profile, or contact FixIt support.');
    elsif old.business_registration_status = 'confirmed' and not by_owner then
      insert into public.provider_notices (provider_id, kind, tone, title, body)
      values (new.id, 'registration', 'info', 'Your registration confirmation was removed', 'FixIt will need to check your registration again.');
    end if;
  end if;

  if new.status is distinct from old.status then
    if new.status = 'approved' then
      insert into public.provider_notices (provider_id, kind, tone, title, body)
      values (new.id, 'approval', 'good', 'Your business is approved', 'Customers can now find you on FixIt.');
    elsif new.status = 'rejected' then
      insert into public.provider_notices (provider_id, kind, tone, title, body)
      values (new.id, 'approval', 'bad', 'Your business was not approved', 'Contact FixIt support to find out what is needed.');
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.write_provider_notices() from public, anon, authenticated;

drop trigger if exists providers_write_notices on public.providers;
create trigger providers_write_notices
  after update on public.providers
  for each row execute function public.write_provider_notices();
