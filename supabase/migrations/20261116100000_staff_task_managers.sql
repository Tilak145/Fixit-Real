-- A manager: a member of staff the owner trusts to hand out the work.
--
--   owner    everything, and decides who is a manager
--   manager  gives tasks to staff, plans their week, follows what is open
--   staff    sees only their own tasks and ticks them off
--
-- A manager is still staff for every other rule in the dashboard: the screens
-- they may open are the ones the owner switched on, and they never reach the
-- owner's own tasks or the owner-only screens.

alter table public.app_roles
  add column if not exists manages_tasks boolean not null default false;

create or replace function public.can_assign_tasks()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select public.is_owner()) or exists (
    select 1 from public.app_roles r
    where r.user_id = (select auth.uid()) and r.manages_tasks
  );
$$;

revoke all on function public.can_assign_tasks() from public, anon;
grant execute on function public.can_assign_tasks() to authenticated;

-- Whether a task's assignee is staff (not an owner). SECURITY DEFINER so the
-- policies below can ask without opening app_roles to the caller.
create or replace function public.is_staff_account(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.app_roles r where r.user_id = p_user_id and r.role = 'manager'
  );
$$;

revoke all on function public.is_staff_account(uuid) from public, anon;
grant execute on function public.is_staff_account(uuid) to authenticated;

drop policy if exists staff_tasks_read on public.staff_tasks;
create policy staff_tasks_read on public.staff_tasks
  for select to authenticated
  using (
    (select public.is_owner())
    or assigned_to = (select auth.uid())
    or ((select public.can_assign_tasks()) and public.is_staff_account(assigned_to))
  );

drop policy if exists staff_tasks_owner_insert on public.staff_tasks;
drop policy if exists staff_tasks_assign_insert on public.staff_tasks;
create policy staff_tasks_assign_insert on public.staff_tasks
  for insert to authenticated
  with check (
    (select public.is_owner())
    or ((select public.can_assign_tasks()) and public.is_staff_account(assigned_to))
  );

drop policy if exists staff_tasks_owner_update on public.staff_tasks;
drop policy if exists staff_tasks_assign_update on public.staff_tasks;
create policy staff_tasks_assign_update on public.staff_tasks
  for update to authenticated
  using (
    (select public.is_owner())
    or ((select public.can_assign_tasks()) and public.is_staff_account(assigned_to))
  )
  with check (
    (select public.is_owner())
    or ((select public.can_assign_tasks()) and public.is_staff_account(assigned_to))
  );

drop policy if exists staff_tasks_owner_delete on public.staff_tasks;
drop policy if exists staff_tasks_assign_delete on public.staff_tasks;
create policy staff_tasks_assign_delete on public.staff_tasks
  for delete to authenticated
  using (
    (select public.is_owner())
    or ((select public.can_assign_tasks()) and public.is_staff_account(assigned_to))
  );

-- A manager may finish or reopen a staff task too, never an owner's.
create or replace function public.set_staff_task_done(p_task_id uuid, p_done boolean, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assigned uuid;
begin
  select assigned_to into v_assigned from public.staff_tasks where id = p_task_id;
  if v_assigned is null then
    raise exception 'That task no longer exists.';
  end if;
  if v_assigned <> (select auth.uid())
     and not (select public.is_owner())
     and not ((select public.can_assign_tasks()) and public.is_staff_account(v_assigned)) then
    raise exception 'That task belongs to someone else.';
  end if;
  if p_done then
    update public.staff_tasks
    set status = 'done', done_at = now(), done_note = nullif(left(btrim(coalesce(p_note, '')), 1000), '')
    where id = p_task_id;
  else
    update public.staff_tasks
    set status = 'open', done_at = null, done_note = null
    where id = p_task_id;
  end if;
end;
$$;

-- The people a task can be given to. The owner sees the whole team; a manager
-- sees staff only. The return type changed, so the old one is dropped first.
drop function if exists public.staff_task_people();
create function public.staff_task_people()
returns table (user_id uuid, email text, role text, manages_tasks boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select public.can_assign_tasks()) then
    raise exception 'Only the owner or a manager may see the team.';
  end if;
  return query
    select r.user_id, u.email::text, r.role, r.manages_tasks
    from public.app_roles r
    join auth.users u on u.id = r.user_id
    where (select public.is_owner()) or r.role = 'manager'
    order by r.role desc, u.email asc;
end;
$$;

revoke all on function public.staff_task_people() from public, anon;
grant execute on function public.staff_task_people() to authenticated;

-- Only the owner decides who is a manager.
create or replace function public.set_task_manager(p_user_id uuid, p_on boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.is_owner()) then
    raise exception 'Only the owner may choose managers.';
  end if;
  if not public.is_staff_account(p_user_id) then
    raise exception 'Only a member of staff can be made a manager.';
  end if;
  update public.app_roles set manages_tasks = p_on where user_id = p_user_id;
end;
$$;

revoke all on function public.set_task_manager(uuid, boolean) from public, anon;
grant execute on function public.set_task_manager(uuid, boolean) to authenticated;
