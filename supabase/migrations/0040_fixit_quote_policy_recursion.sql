-- Fix a recursion the previous migration introduced.
--
-- 0039 asked the insert policy to check "this request has no accepted quote yet"
-- by reading the quotes table from inside a policy on quotes. Evaluating that
-- policy makes PostgreSQL evaluate the same policy again, and the insert fails
-- with "infinite recursion detected in policy for relation quotes". A table
-- cannot police itself this way.
--
-- The check moves into a BEFORE INSERT trigger, which runs as its owner and so
-- is not subject to the policy it is helping enforce. The rule is unchanged: a
-- price may be sent while the request is still open and nobody has been chosen.

-- The policy keeps only what does not read quotes.
drop policy if exists quotes_provider_insert on public.quotes;
create policy quotes_provider_insert on public.quotes
  for insert to authenticated
  with check (
    provider_id in (select id from public.providers where auth_user_id = (select auth.uid()))
    and exists (
      select 1
      from public.quote_requests q
      join public.providers p on p.auth_user_id = (select auth.uid())
      join public.provider_services s on s.provider_id = p.id and s.category_slug = q.category_slug
      join public.provider_service_areas a on a.provider_id = p.id and a.city = q.city
      where q.id = quote_request_id
        and (p.accepting_work or q.claimed_by = p.id)
    )
  );

create or replace function public.quotes_open_request_only()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := (select auth.uid());
  v_status text;
  v_accepted integer;
begin
  -- Server-side writes are the platform's own; skip the user-facing rules.
  if v_caller is null or (select public.is_admin()) then
    return new;
  end if;

  select q.status into v_status
  from public.quote_requests q
  where q.id = new.quote_request_id;

  if v_status is null then
    raise exception 'That job no longer exists.' using errcode = 'check_violation';
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

drop trigger if exists quotes_open_request_only on public.quotes;
create trigger quotes_open_request_only
  before insert on public.quotes
  for each row execute function public.quotes_open_request_only();
