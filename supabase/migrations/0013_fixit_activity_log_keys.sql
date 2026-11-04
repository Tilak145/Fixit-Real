-- service_categories is keyed by slug, not id, so the first version of the
-- activity trigger failed on any change to the catalogue with
-- `record "new" has no field "id"`. Build the JSON first and read the key out
-- of it, so the trigger works for a table with either key.

create or replace function public.log_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  summary jsonb;
  record_id text;
begin
  -- Inserted rows arrive in new, deleted rows in old; updates report the new
  -- shape, which is what the dashboard shows afterwards.
  if tg_op = 'DELETE' then
    summary := to_jsonb(old);
  else
    summary := to_jsonb(new);
  end if;

  -- Not every table has an `id`: service_categories is keyed by slug.
  record_id := coalesce(summary ->> 'id', summary ->> 'slug', '');

  -- Keep the newest values only: this is a trail to read, not a backup.
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
