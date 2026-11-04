-- What each member of staff may open.
--
-- Until now a staff member had one fixed list of screens. The owner now decides
-- it person by person. The choice is stored on the person's app_roles row and
-- checked in the database, so it holds for the website and the phone app alike
-- and cannot be worked around by typing a page's address.
--
-- A member of staff with no saved choice keeps the list staff have always had,
-- so nobody loses access the moment this rule lands.

alter table public.app_roles
  drop constraint if exists app_roles_permissions_check;
alter table public.app_roles
  add column if not exists permissions text[];

alter table public.app_roles
  drop constraint if exists app_roles_permissions_check;

alter table public.app_roles
  add constraint app_roles_permissions_check
  check (permissions is null or permissions <@ array[
    'overview', 'dispatch', 'pro_lookup', 'lead_integrity',
    'providers', 'quote_requests', 'quote_request_contacts', 'provider_availability',
    'quotes', 'appointments', 'provider_documents', 'reviews',
    'messages', 'lead_disputes', 'activity'
  ]::text[]);

-- The screens every staff member has; used while someone has no saved choice.
create or replace function public.default_staff_permissions()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'overview', 'dispatch', 'pro_lookup', 'lead_integrity',
    'providers', 'quote_requests', 'quote_request_contacts', 'provider_availability',
    'quotes', 'appointments', 'provider_documents', 'reviews',
    'messages', 'lead_disputes', 'activity'
  ]::text[];
$$;

-- The current person's own saved choice, readable by them alone.
create or replace function public.my_staff_permissions()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select r.permissions from public.app_roles r where r.user_id = (select auth.uid());
$$;

revoke all on function public.my_staff_permissions() from public;
grant execute on function public.my_staff_permissions() to authenticated;

-- The screens this caller works with: the owner has all of them; staff have
-- exactly the ones the owner saved for them.
create or replace function public.my_workspace_permissions()
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select public.is_owner()) then
    return public.default_staff_permissions()
      || array['commissions', 'customer_lookup', 'trial_reminders', 'service_waitlist',
               'accounts', 'team', 'service_cities', 'service_categories']::text[];
  end if;
  return coalesce((select public.my_staff_permissions()), public.default_staff_permissions());
end;
$$;

revoke all on function public.my_workspace_permissions() from public;
grant execute on function public.my_workspace_permissions() to authenticated;

-- One screen, or every one of the screens listed.
create or replace function public.can_open(p_screen text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_screens text[];
begin
  if (select public.is_owner()) then
    return true;
  end if;
  v_screens := (select public.my_staff_permissions());
  if v_screens is null then
    return true;
  end if;
  return p_screen = any (v_screens);
end;
$$;

revoke all on function public.can_open(text) from public;
grant execute on function public.can_open(text) to authenticated;

-- The owner's screen for one member of staff: their role and chosen screens.
create or replace function public.staff_access()
returns table (user_id uuid, role text, permissions text[], created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select public.is_owner()) then
    raise exception 'Only the owner may see staff access.';
  end if;
  return query
    select r.user_id, r.role, r.permissions, r.created_at
    from public.app_roles r
    order by r.created_at asc;
end;
$$;

revoke all on function public.staff_access() from public;
grant execute on function public.staff_access() to authenticated;

-- Save one staff member's screens. Null restores the standard staff list.
create or replace function public.set_staff_permissions(p_user_id uuid, p_permissions text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_clean text[];
begin
  if not (select public.is_owner()) then
    raise exception 'Only the owner may change staff access.';
  end if;
  select role into v_role from public.app_roles where user_id = p_user_id;
  if v_role is null then
    raise exception 'That account does not work in the dashboard.';
  end if;
  if p_permissions is null then
    update public.app_roles set permissions = null where user_id = p_user_id;
    return;
  end if;
  if not (p_permissions <@ public.default_staff_permissions()) then
    raise exception 'Those screens can only be opened by the owner.';
  end if;
  select coalesce(array_agg(kept.p order by kept.first_at), '{}') into v_clean
  from (
    select p, min(i) as first_at
    from unnest(p_permissions) with ordinality as t(p, i)
    group by p
  ) kept;
  update public.app_roles set permissions = v_clean where user_id = p_user_id;
end;
$$;

revoke all on function public.set_staff_permissions(uuid, text[]) from public;
grant execute on function public.set_staff_permissions(uuid, text[]) to authenticated;

-- Licence checks, insurance, business registration and the lead dispute
-- decisions live on screens the owner can grant, so the database asks about the
-- screen instead of the role.
create or replace function public.can_review_leads()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_screens text[];
begin
  if (select public.is_owner()) then
    return true;
  end if;
  v_screens := coalesce((select public.my_staff_permissions()), public.default_staff_permissions());
  return v_screens && array['lead_integrity', 'providers']::text[];
end;
$$;

revoke all on function public.can_review_leads() from public;
grant execute on function public.can_review_leads() to authenticated;

-- The functions that record a licence, insurance or business check keep their
-- definitions, and ask whether this person may open the Professionals screen.

create or replace function public.check_provider_license(provider_id uuid)
returns table (status text, note text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  raw text;
  compact text;
  verdict text;
  message text;
  duplicate boolean;
begin
  if not (select public.can_open('providers')) then
    raise exception 'You do not have access to check licences.';
  end if;

  select p.license_number into raw from public.providers p where p.id = provider_id;
  if not found then
    raise exception 'No provider with that id.';
  end if;

  compact := upper(regexp_replace(coalesce(raw, ''), '[^A-Za-z0-9]', '', 'g'));

  if raw is null or btrim(raw) = '' then
    verdict := 'format_invalid';
    message := 'No licence number was supplied.';
  elsif length(compact) < 4 or length(compact) > 24 then
    verdict := 'format_invalid';
    message := 'A licence number should be 4 to 24 letters and digits.';
  elsif compact !~ '^[A-Z0-9]+$' then
    verdict := 'format_invalid';
    message := 'Use letters and digits only.';
  elsif compact !~ '[0-9]' then
    verdict := 'format_invalid';
    message := 'A licence number should contain at least one digit.';
  else
    select exists (
      select 1 from public.providers p
      where p.id <> provider_id
        and p.license_number is not null
        and upper(regexp_replace(p.license_number, '[^A-Za-z0-9]', '', 'g')) = compact
    ) into duplicate;

    if duplicate then
      verdict := 'lookup_failed';
      message := 'Another professional already uses this licence number.';
    else
      verdict := 'format_ok';
      message := 'Looks like a valid licence number. Confirm it against the state register before approving.';
    end if;
  end if;

  perform set_config('spk.license_check', 'on', true);
  update public.providers
  set license_status = verdict,
      license_note = message,
      license_checked_at = now()
  where id = provider_id;

  return query select verdict, message;
end;
$$;

create or replace function public.verify_provider_evidence(
  provider_id uuid,
  evidence text,
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
  if not (select public.can_open('providers')) then
    raise exception 'You do not have access to verify a professional.';
  end if;

  if evidence = 'license' then
    if verdict not in ('lookup_verified', 'format_ok', 'format_invalid', 'lookup_failed') then
      raise exception 'Unknown licence verdict: %', verdict;
    end if;
    perform set_config('spk.license_check', 'on', true);
    update public.providers
    set license_status = verdict,
        license_note = note,
        license_checked_at = now(),
        license_verified_at = case when verdict = 'lookup_verified' then now() else null end,
        license_verified_by = case when verdict = 'lookup_verified' then v_caller else null end
    where id = provider_id;
    return;
  end if;

  if evidence = 'insurance' then
    if verdict not in ('verified', 'rejected', 'unverified') then
      raise exception 'Unknown insurance verdict: %', verdict;
    end if;
    perform set_config('spk.license_check', 'on', true);
    update public.providers
    set insurance_status = verdict,
        insurance_verified_at = case when verdict = 'verified' then now() else null end,
        insurance_verified_by = case when verdict = 'verified' then v_caller else null end
    where id = provider_id;
    return;
  end if;

  raise exception 'Unknown evidence: %', evidence;
end;
$$;

create or replace function public.verify_business_registration(provider_id uuid, verdict text, note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := (select auth.uid());
begin
  if not (select public.can_open('providers')) then
    raise exception 'You do not have access to check a business registration.';
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
