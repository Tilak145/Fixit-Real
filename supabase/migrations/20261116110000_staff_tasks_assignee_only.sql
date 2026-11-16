-- A task goes only to the person it is assigned to.
--
-- A manager used to see every task belonging to staff. Now a task is seen by:
--   the person it is assigned to,
--   the person who gave it (so they can follow up, change or remove it),
--   the owner.
-- Nobody else, manager or not.

create or replace function public.gave_staff_task(p_created_by uuid, p_assigned_to uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_created_by = (select auth.uid())
    and (select public.can_assign_tasks())
    and public.is_staff_account(p_assigned_to);
$$;

revoke all on function public.gave_staff_task(uuid, uuid) from public, anon;
grant execute on function public.gave_staff_task(uuid, uuid) to authenticated;

drop policy if exists staff_tasks_read on public.staff_tasks;
create policy staff_tasks_read on public.staff_tasks
  for select to authenticated
  using (
    (select public.is_owner())
    or assigned_to = (select auth.uid())
    or public.gave_staff_task(created_by, assigned_to)
  );

drop policy if exists staff_tasks_assign_update on public.staff_tasks;
create policy staff_tasks_assign_update on public.staff_tasks
  for update to authenticated
  using ((select public.is_owner()) or public.gave_staff_task(created_by, assigned_to))
  with check ((select public.is_owner()) or public.gave_staff_task(created_by, assigned_to));

drop policy if exists staff_tasks_assign_delete on public.staff_tasks;
create policy staff_tasks_assign_delete on public.staff_tasks
  for delete to authenticated
  using ((select public.is_owner()) or public.gave_staff_task(created_by, assigned_to));

-- Who gave the task can never be rewritten, or the rule above could be dodged.
create or replace function public.staff_tasks_stamp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce((select auth.uid()), new.created_by);
    new.status := 'open';
    new.done_at := null;
    new.done_note := null;
  else
    new.created_by := old.created_by;
  end if;
  new.title := btrim(new.title);
  return new;
end;
$$;

create or replace function public.set_staff_task_done(p_task_id uuid, p_done boolean, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assigned uuid;
  v_created uuid;
begin
  select assigned_to, created_by into v_assigned, v_created from public.staff_tasks where id = p_task_id;
  if v_assigned is null then
    raise exception 'That task no longer exists.';
  end if;
  if v_assigned <> (select auth.uid())
     and not (select public.is_owner())
     and not public.gave_staff_task(v_created, v_assigned) then
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
