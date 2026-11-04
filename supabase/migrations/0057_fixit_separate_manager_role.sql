-- Two dashboard roles that mean two different things.
--
-- 'admin' is the owner: whoever runs FixIt, controls who works here, and may
-- change the settings that decide how the business behaves.
-- 'manager' is staff the owner invited: they run the daily marketplace work —
-- approving professionals, watching quotes, leads, visits, reviews and cities —
-- but they cannot change the team, look at every account, read or change the
-- mail key, or look a customer up by number.
--
-- Until now 'manager' was accepted at sign-in but is_admin() only looked for a
-- row of any role, so both behaved the same when the RLS was written. This
-- makes the narrower check real and applies the same rule to the functions and
-- tables that expose the sensitive screens.

-- The owned, settings-like tables: owner only, for reading and writing.
do $$
declare
  t text;
begin
  foreach t in array array['service_cities', 'service_categories', 'mail_settings']
  loop
    if exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = t
    ) then
      -- The existing write policies are named <table>_admin_write.
      execute format('drop policy if exists %I on public.%I', t || '_admin_write', t);
      execute format(
        'create policy %I on public.%I for all to authenticated using ((select public.is_owner())) with check ((select public.is_owner()))',
        t || '_owner_write', t
      );
    end if;
  end loop;
end;
$$;

-- These functions expose account-wide views, so staff must not reach them.
create or replace function public.trial_reminders()
returns table (
  provider_id uuid,
  business_name text,
  email text,
  plan text,
  price_per_month int,
  trial_ends_at timestamptz,
  days_left int,
  reminder_id uuid,
  reminder_status text,
  message text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select public.is_owner()) then
    raise exception 'Only the owner may see trial reminders.';
  end if;
  return query
    select
      p.id,
      p.business_name,
      p.email,
      coalesce(r.plan, 'professional'),
      coalesce(r.price_per_month,
        case coalesce(r.plan, 'professional')
          when 'starter' then 99 when 'business' then 399 else 199 end),
      p.trial_ends_at,
      greatest(0, ceil(extract(epoch from (p.trial_ends_at - now())) / 86400))::int,
      r.id,
      coalesce(r.status, 'due'),
      public.trial_reminder_message(
        p.business_name, p.trial_ends_at,
        coalesce(r.plan, 'professional'),
        coalesce(r.price_per_month, 199))
    from public.providers p
    left join public.pro_trial_reminders r
      on r.provider_id = p.id and r.trial_ends_at = p.trial_ends_at
    where p.plan = 'founding'
      and p.trial_ends_at is not null
      and p.trial_ends_at > now()
    order by p.trial_ends_at asc;
end;
$$;

revoke all on function public.trial_reminders() from public;
grant execute on function public.trial_reminders() to authenticated;

create or replace function public.mail_status()
returns table (ready boolean, provider text, from_address text, has_key boolean, updated_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  row public.mail_settings;
begin
  if not (select public.is_owner()) then
    raise exception 'Only the owner may see mail settings.';
  end if;
  select * into row from public.mail_settings limit 1;
  return query select
    coalesce(row.api_key is not null and row.from_address is not null, false),
    row.provider,
    row.from_address,
    row.api_key is not null,
    row.updated_at;
end;
$$;

revoke all on function public.mail_status() from public;
grant execute on function public.mail_status() to authenticated;

-- Who holds a dashboard role, for the owner's Team screen.
create or replace function public.admin_team_roles()
returns table (user_id uuid, role text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select public.is_owner()) then
    raise exception 'Only the owner may see the dashboard team.';
  end if;
  return query select r.user_id, r.role, r.created_at from public.app_roles r order by r.created_at asc;
end;
$$;

revoke all on function public.admin_team_roles() from public;
grant execute on function public.admin_team_roles() to authenticated;

-- Move someone between staff and owner. An owner's own role cannot change
-- through this door, and the last owner still cannot be demoted.
create or replace function public.set_team_role(p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.is_owner()) then
    raise exception 'Only the owner may change who works here.';
  end if;
  if p_role not in ('admin', 'manager') then
    raise exception 'Choose owner or staff.';
  end if;
  if p_user_id = (select auth.uid()) then
    raise exception 'You cannot change your own role.';
  end if;
  if not exists (select 1 from public.app_roles where user_id = p_user_id) then
    raise exception 'That account does not work in the dashboard.';
  end if;
  update public.app_roles set role = p_role where user_id = p_user_id;
end;
$$;

revoke all on function public.set_team_role(uuid, text) from public;
grant execute on function public.set_team_role(uuid, text) to authenticated;

-- Remove someone from the dashboard entirely.
create or replace function public.remove_team_member(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.is_owner()) then
    raise exception 'Only the owner may change who works here.';
  end if;
  if p_user_id = (select auth.uid()) then
    raise exception 'You cannot remove your own access.';
  end if;
  delete from public.app_roles where user_id = p_user_id;
end;
$$;

revoke all on function public.remove_team_member(uuid) from public;
grant execute on function public.remove_team_member(uuid) to authenticated;

-- Give an existing account a dashboard role, without touching its password.
create or replace function public.add_team_member(p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.is_owner()) then
    raise exception 'Only the owner may change who works here.';
  end if;
  if p_role not in ('admin', 'manager') then
    raise exception 'Choose owner or staff.';
  end if;
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'That account does not exist.';
  end if;
  insert into public.app_roles (user_id, role) values (p_user_id, p_role)
  on conflict (user_id) do update set role = excluded.role;
end;
$$;

revoke all on function public.add_team_member(uuid, text) from public;
grant execute on function public.add_team_member(uuid, text) to authenticated;
