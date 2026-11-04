-- The account that owns FixIt cannot be demoted or removed by anyone.
--
-- Until now only the *last* owner was protected, so with two owners either
-- could switch the other to staff or remove them. The owner names their own
-- account in PROTECTED_OWNER_EMAIL below; the database then refuses every way
-- of changing that account's role, including direct writes, not just the
-- dashboard's own functions.

create table if not exists public.protected_owner (
  user_id uuid primary key references auth.users(id) on delete cascade,
  locked_at timestamptz not null default now()
);

alter table public.protected_owner enable row level security;

-- Nobody reads this through the API; the trigger below reads it as its owner.
revoke all on table public.protected_owner from anon, authenticated;

-- Point this at the account that must always keep owner access.
insert into public.protected_owner (user_id)
select u.id
from auth.users u
where lower(u.email) = 'pnpnews8@gmail.com'
on conflict (user_id) do nothing;

-- The owner-protection trigger keeps its "last owner" rule and adds this one:
-- the protected account can never be demoted or deleted, whoever asks.
create or replace function public.app_roles_keep_an_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.protected_owner p where p.user_id = old.user_id)
     and (
       tg_op = 'DELETE'
       or (tg_op = 'UPDATE' and new.role is distinct from 'admin')
     )
  then
    raise exception 'This account always keeps owner access; it cannot be changed.';
  end if;

  if (tg_op = 'DELETE' and old.role = 'admin'
      and not exists (select 1 from public.app_roles where role = 'admin' and user_id <> old.user_id))
  then
    raise exception 'The last owner cannot be removed.';
  end if;
  if (tg_op = 'UPDATE' and old.role = 'admin' and new.role <> 'admin'
      and not exists (select 1 from public.app_roles where role = 'admin' and user_id <> old.user_id))
  then
    raise exception 'The last owner cannot be demoted.';
  end if;
  return coalesce(new, old);
end;
$$;

-- Clear messages before the trigger fires, so the dashboard shows the reason
-- in the owner's own words rather than a raw database error.
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
  if exists (select 1 from public.protected_owner p where p.user_id = p_user_id) then
    raise exception 'That account is the protected owner and always keeps owner access.';
  end if;
  if not exists (select 1 from public.app_roles where user_id = p_user_id) then
    raise exception 'That account does not work in the dashboard.';
  end if;
  update public.app_roles set role = p_role where user_id = p_user_id;
end;
$$;

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
  if exists (select 1 from public.protected_owner p where p.user_id = p_user_id) then
    raise exception 'That account is the protected owner and cannot be removed.';
  end if;
  delete from public.app_roles where user_id = p_user_id;
end;
$$;

-- The access editor never applies to an owner's screens; make that explicit so
-- a protected owner can never be limited by a mistaken save.
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
  select r.role into v_role from public.app_roles r where r.user_id = p_user_id;
  if v_role is null then
    raise exception 'That account does not work in the dashboard.';
  end if;
  if v_role = 'admin' then
    raise exception 'Owners always have every screen; staff access does not apply to them.';
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
    select t.p, min(t.i) as first_at
    from unnest(p_permissions) with ordinality as t(p, i)
    group by t.p
  ) kept;
  update public.app_roles set permissions = v_clean where user_id = p_user_id;
end;
$$;

-- Reading back who is protected, for the dashboard to show honestly.
create or replace function public.protected_owner_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(p.user_id), '{}') from public.protected_owner p;
$$;

revoke all on function public.protected_owner_ids() from public;
grant execute on function public.protected_owner_ids() to authenticated;
