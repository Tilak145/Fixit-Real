-- The dashboard grows from one administrator into a small team. A role now
-- says what someone may do there:
--
--   admin   the owner: everything, including who else may sign in
--   manager staff: the marketplace itself, but not the team list
--
-- Existing rows keep full access, so nothing already working changes meaning.
-- is_admin() stays "may use the dashboard" and is_admin() has always meant
-- exactly that; is_owner() is the narrower check for the team section.

alter table public.app_roles
  drop constraint if exists app_roles_role_check;

alter table public.app_roles
  add constraint app_roles_role_check check (role in ('admin', 'manager'));

-- Who may hand out dashboard access. SECURITY DEFINER, like is_admin(), so the
-- lookup runs outside the caller's row security and a policy on app_roles that
-- calls it cannot recurse.
create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.app_roles
    where user_id = (select auth.uid()) and role = 'admin'
  );
$$;

revoke all on function public.is_owner() from public;
grant execute on function public.is_owner() to authenticated;

-- The team list: any dashboard member may see who else works here, but only the
-- owner changes it. app_roles_self_read already lets everyone read their own
-- row; these add the rest.
drop policy if exists app_roles_team_read on public.app_roles;
create policy app_roles_team_read on public.app_roles
  for select to authenticated
  using ((select public.is_admin()));

drop policy if exists app_roles_owner_write on public.app_roles;
create policy app_roles_owner_write on public.app_roles
  for insert to authenticated
  with check ((select public.is_owner()));

drop policy if exists app_roles_owner_update on public.app_roles;
create policy app_roles_owner_update on public.app_roles
  for update to authenticated
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

-- Removing the last owner would lock everyone out of the team section, so the
-- database refuses it rather than trusting the page to.
create or replace function public.app_roles_keep_an_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
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

drop trigger if exists app_roles_keep_an_owner on public.app_roles;
create trigger app_roles_keep_an_owner
  before update or delete on public.app_roles
  for each row execute function public.app_roles_keep_an_owner();
