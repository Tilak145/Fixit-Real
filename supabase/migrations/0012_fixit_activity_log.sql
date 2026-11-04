-- A dashboard with more than one person in it needs a record of who changed
-- what. Every touched business table gets one row here per insert, update or
-- delete, written by the database itself so the page cannot forget to.
--
-- The actor is whatever account PostgREST authenticated for the statement.
-- Dashboard writes are the ones this is for, but the trigger is on the table,
-- not the role, so a provider editing their own listing is recorded too.

create table if not exists public.activity_log (
  id bigint generated always as identity primary key,
  table_name text not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  row_id text,
  actor_id uuid,
  actor_email text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists activity_log_recent_idx
  on public.activity_log (created_at desc);

create index if not exists activity_log_actor_idx
  on public.activity_log (actor_id, created_at desc);

alter table public.activity_log enable row level security;

-- Read-only to the dashboard, and nothing may change a record once written:
-- no insert, update or delete policies exist, so only the trigger (which runs
-- as the table owner) can add rows.
drop policy if exists activity_log_admin_read on public.activity_log;
create policy activity_log_admin_read on public.activity_log
  for select to authenticated
  using ((select public.is_admin()));

create or replace function public.log_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  record_id text;
  summary jsonb;
begin
  -- Inserted rows arrive in new, deleted rows in old; updates report the new
  -- shape, which is what the dashboard shows afterwards.
  if tg_op = 'DELETE' then
    record_id := coalesce(old.id::text, '');
  else
    record_id := coalesce(new.id::text, '');
  end if;

  -- Keep the newest values only, and cap the size: this is a trail to read,
  -- not a backup to restore from.
  if tg_op = 'DELETE' then
    summary := to_jsonb(old);
  else
    summary := to_jsonb(new);
  end if;
  summary := jsonb_strip_nulls(summary);
  summary := summary - 'id' - 'created_at' - 'updated_at';

  insert into public.activity_log (table_name, action, row_id, actor_id, actor_email, detail)
  values (
    tg_table_name,
    lower(tg_op),
    nullif(record_id, ''),
    (select auth.uid()),
    (select u.email::text from auth.users u where u.id = (select auth.uid())),
    summary
  );
  return coalesce(new, old);
end;
$$;

-- One trigger per business table the dashboard manages. Dropped and recreated
-- so re-running the migration stays harmless.
do $$
declare
  target text;
begin
  foreach target in array array[
    'providers', 'quote_requests', 'reviews', 'appointments', 'messages',
    'service_categories'
  ]
  loop
    execute format('drop trigger if exists log_activity on public.%I', target);
    execute format(
      'create trigger log_activity after insert or update or delete on public.%I
         for each row execute function public.log_activity()',
      target
    );
  end loop;
end;
$$;
