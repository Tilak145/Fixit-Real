
-- The business registration number, checked against the Ohio Secretary of State.
--
-- FixIt already records a trade licence and checks its shape. A trade licence
-- says a person may do the work; a Secretary of State registration says the
-- *business* legally exists in Ohio, which is the other half of "is this a real
-- contractor". Homeowners ask both, in that order.
--
-- There is no automated lookup, and the honest reason is that there cannot be
-- one: businesssearch.ohiosos.gov sits behind Cloudflare and answers a server
-- request with 403, so a bot on our side cannot query it. What the dashboard
-- can do is record the number the professional gives, and put a one-click link
-- to the official register next to it so the person approving the account looks
-- it up and records what they found. The status below is that record, and only
-- dashboard staff can set it.

alter table public.providers
  add column if not exists business_registration_number text,
  add column if not exists business_registration_status text not null default 'unverified'
    check (business_registration_status in ('unverified', 'confirmed', 'not_found')),
  add column if not exists business_registration_checked_at timestamptz,
  add column if not exists business_registration_checked_by uuid references auth.users(id) on delete set null;

-- Extend the guard from 0015/0042 so an applicant cannot mark their own
-- business registration confirmed. The same rule as the licence: only the
-- verification function, which flags its own write, may set a passing state.
create or replace function public.providers_guard_license_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.is_admin())
     and coalesce(current_setting('spk.license_check', true), '') <> 'on' then
    if tg_op = 'INSERT' then
      new.license_status := 'unverified';
      new.license_note := null;
      new.license_checked_at := null;
      new.insurance_status := 'unverified';
      new.insurance_verified_at := null;
      new.insurance_verified_by := null;
      new.business_registration_status := 'unverified';
      new.business_registration_checked_at := null;
      new.business_registration_checked_by := null;
    else
      if new.license_status is distinct from old.license_status
         or new.license_note is distinct from old.license_note
         or new.license_number is distinct from old.license_number then
        new.license_status := 'unverified';
        new.license_note := null;
        new.license_checked_at := null;
      end if;
      if new.insurance_status is distinct from old.insurance_status
         or new.insurance_verified_at is distinct from old.insurance_verified_at
         or new.insurance_verified_by is distinct from old.insurance_verified_by then
        new.insurance_status := 'unverified';
        new.insurance_verified_at := null;
        new.insurance_verified_by := null;
      end if;
      if new.business_registration_status is distinct from old.business_registration_status
         or new.business_registration_checked_at is distinct from old.business_registration_checked_at
         or new.business_registration_checked_by is distinct from old.business_registration_checked_by then
        new.business_registration_status := 'unverified';
        new.business_registration_checked_at := null;
        new.business_registration_checked_by := null;
      end if;
    end if;
  end if;
  return new;
end;
$$;

-- Record what the person found on the register. 'confirmed' means they looked
-- the number up and it matched; 'not_found' means they looked and it did not.
-- Both record who and when, so a claim is never unattributed.
create or replace function public.verify_business_registration(
  provider_id uuid,
  verdict text,
  note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := (select auth.uid());
begin
  if not (select public.is_admin()) then
    raise exception 'Only dashboard staff may check a business registration.';
  end if;
  if verdict not in ('confirmed', 'not_found', 'unverified') then
    raise exception 'Unknown business registration verdict: %', verdict;
  end if;

  perform set_config('spk.license_check', 'on', true);
  update public.providers
  set business_registration_status = verdict,
      business_registration_checked_at = case when verdict = 'unverified' then null else now() end,
      business_registration_checked_by = case when verdict = 'unverified' then null else v_caller end
  where id = provider_id;
end;
$$;

revoke all on function public.verify_business_registration(uuid, text, text) from public;
grant execute on function public.verify_business_registration(uuid, text, text) to authenticated;

-- The admin dashboard and the pro's own workspace both read these columns, and
-- column grants are additive to the table-level SELECT already in place, so the
-- new columns are granted alongside the existing ones.
grant select (business_registration_number, business_registration_status) on public.providers to anon, authenticated;

