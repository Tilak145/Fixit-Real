-- Work the owner hands to a member of staff.
--
-- The dashboard already decides which screens each person may open. This adds
-- the other half of a job: a list of things one named person is expected to do,
-- with a due date, that they tick off and the owner can follow.
--
--   owner   writes tasks, gives them to anyone on the team, changes or removes them
--   staff   sees only their own, and may only mark one done (with a note) or reopen it

create table if not exists public.staff_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 3 and 200),
  details text check (details is null or char_length(details) <= 2000),
  -- The screen where the work is done, so the task can open it in one click.
  screen text,
  assigned_to uuid not null references public.app_roles (user_id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  due_on date,
  status text not null default 'open' check (status in ('open', 'done')),
  done_at timestamptz,
  done_note text check (done_note is null or char_length(done_note) <= 1000),
  created_at timestamptz not null default now()
);

create index if not exists staff_tasks_assigned_idx on public.staff_tasks (assigned_to, status);

alter table public.staff_tasks enable row level security;

revoke all on public.staff_tasks from anon, authenticated;
grant select, insert, update, delete on public.staff_tasks to authenticated;

drop policy if exists staff_tasks_read on public.staff_tasks;
create policy staff_tasks_read on public.staff_tasks
  for select to authenticated
  using ((select public.is_owner()) or assigned_to = (select auth.uid()));

drop policy if exists staff_tasks_owner_insert on public.staff_tasks;
create policy staff_tasks_owner_insert on public.staff_tasks
  for insert to authenticated
  with check ((select public.is_owner()));

drop policy if exists staff_tasks_owner_update on public.staff_tasks;
create policy staff_tasks_owner_update on public.staff_tasks
  for update to authenticated
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

drop policy if exists staff_tasks_owner_delete on public.staff_tasks;
create policy staff_tasks_owner_delete on public.staff_tasks
  for delete to authenticated
  using ((select public.is_owner()));

-- Who wrote the task is stamped here, never taken from the page.
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
  end if;
  new.title := btrim(new.title);
  return new;
end;
$$;

drop trigger if exists staff_tasks_stamp on public.staff_tasks;
create trigger staff_tasks_stamp
  before insert or update on public.staff_tasks
  for each row execute function public.staff_tasks_stamp();

-- The one change a member of staff may make: finish their own task, or reopen it.
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
  if v_assigned <> (select auth.uid()) and not (select public.is_owner()) then
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

revoke all on function public.set_staff_task_done(uuid, boolean, text) from public, anon;
grant execute on function public.set_staff_task_done(uuid, boolean, text) to authenticated;

-- The people a task can be given to, with the email the owner knows them by.
create or replace function public.staff_task_people()
returns table (user_id uuid, email text, role text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select public.is_owner()) then
    raise exception 'Only the owner may see the team.';
  end if;
  return query
    select r.user_id, u.email::text, r.role
    from public.app_roles r
    join auth.users u on u.id = r.user_id
    order by r.role desc, u.email asc;
end;
$$;

revoke all on function public.staff_task_people() from public, anon;
grant execute on function public.staff_task_people() to authenticated;
