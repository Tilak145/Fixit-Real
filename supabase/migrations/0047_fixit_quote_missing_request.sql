
-- The quote guard skipped admins, which leaked a raw foreign-key error.
--
-- The owner's account is an admin *and* a professional: the same person signs
-- into the management dashboard and, with their "Tilak Plumbing" profile, signs
-- into the pro dashboard to send a real quote. quotes_open_request_only treated
-- every admin write as the platform's own maintenance and returned before
-- checking anything, so when a professional account that happens to be an admin
-- priced a job whose request had gone missing, PostgreSQL's bare
-- "violates foreign key constraint quotes_quote_request_id_fkey" reached the
-- screen instead of the sentence the guard exists to say.
--
-- The early return is narrowed to what it was meant for: a write with no
-- signed-in user, which is the platform maintaining its own data. An admin is
-- still a person using the app, so the existence check now runs for them too
-- and they get "That job no longer exists." The business rules below it
-- (closed job, a professional already chosen) still step aside for an admin
-- repairing data, because those are decisions about a job that does exist.

create or replace function public.quotes_open_request_only()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := (select auth.uid());
  v_is_admin boolean := (select public.is_admin());
  v_status text;
  v_accepted integer;
begin
  -- A write with no signed-in user is the platform's own; skip the rules.
  if v_caller is null then
    return new;
  end if;

  -- The job must exist for everyone, admin included: quoting a request that is
  -- gone is never a real action, and this is where the clear message is owed.
  select q.status into v_status
  from public.quote_requests q
  where q.id = new.quote_request_id;

  if v_status is null then
    raise exception 'That job no longer exists.' using errcode = 'check_violation';
  end if;

  -- An admin repairing data is not a professional quoting a job, so the rest
  -- of the rules step aside for them.
  if v_is_admin then
    return new;
  end if;

  if v_status = 'completed' then
    raise exception 'This job is already closed, so a new price cannot be sent.'
      using errcode = 'check_violation';
  end if;

  select count(*) into v_accepted
  from public.quotes
  where quote_request_id = new.quote_request_id
    and status = 'accepted';

  if v_accepted > 0 then
    raise exception 'The customer already chose a professional for this job.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- A guard cannot outrun the foreign key it is protecting: if the check above is
-- ever skipped, PostgreSQL still refuses the row, and the raw constraint name
-- is what the professional reads. This keeps the guard the only voice on a
-- missing request by running it first, which is what the ordering above does.
drop trigger if exists quotes_open_request_only on public.quotes;
create trigger quotes_open_request_only
  before insert on public.quotes
  for each row execute function public.quotes_open_request_only();

