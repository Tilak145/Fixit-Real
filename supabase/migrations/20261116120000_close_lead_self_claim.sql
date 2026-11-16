-- Close the lead self-claim hole.
--
-- A request is handed to a professional in two ways only: the customer accepts
-- that professional's price (quotes_award_on_accept), or dashboard staff
-- dispatch an emergency. Both run with their own rights.
--
-- The update rule on quote_requests also let any approved professional whose
-- trade and city matched an unclaimed request write to it directly. That was
-- left from the old "claim a lead" model. With it, a professional could set
-- claimed_by to themselves, book a visit on the request, and so unlock the
-- customer's phone, email and address without ever being chosen.
--
-- Three changes, each closing one step of that path:
--   1. A professional may update only a request already handed to them.
--   2. On such a request they may change one thing: mark it completed.
--   3. A professional may book or change a visit only on a request handed to
--      them, never on one they merely match.

-- 1. Only the professional who holds the request may write to it.
drop policy if exists "claiming provider updates lead" on public.quote_requests;
create policy "claiming provider updates lead" on public.quote_requests
  for update
  using (
    claimed_by in (select p.id from public.providers p where p.auth_user_id = (select auth.uid()))
  )
  with check (
    claimed_by in (select p.id from public.providers p where p.auth_user_id = (select auth.uid()))
  );

-- 2. What that professional may change. Staff, the customer's own actions
--    (accepting a price runs as the customer) and server-side jobs are not
--    limited here; their own rules already cover them.
create or replace function public.quote_requests_lock_for_pros()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
     or (select public.is_admin())
     or (select auth.uid()) is not distinct from old.customer_user_id then
    return new;
  end if;
  if (to_jsonb(new) - 'status' - 'fingerprint') is distinct from (to_jsonb(old) - 'status' - 'fingerprint') then
    raise exception 'A professional cannot change a customer''s request.'
      using errcode = 'insufficient_privilege';
  end if;
  if new.status is distinct from old.status and new.status <> 'completed' then
    raise exception 'A professional can only mark a request completed.'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

revoke all on function public.quote_requests_lock_for_pros() from public, anon, authenticated;

drop trigger if exists quote_requests_a_lock_for_pros on public.quote_requests;
create trigger quote_requests_a_lock_for_pros
  before update on public.quote_requests
  for each row execute function public.quote_requests_lock_for_pros();

-- 3. A visit belongs to a request the professional holds.
drop policy if exists "providers manage own appointments" on public.appointments;
create policy "providers manage own appointments" on public.appointments
  for all
  using (
    exists (
      select 1 from public.providers p
      where p.id = appointments.provider_id and p.auth_user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.providers p
      join public.quote_requests q on q.claimed_by = p.id
      where p.id = appointments.provider_id
        and p.auth_user_id = (select auth.uid())
        and q.id = appointments.quote_request_id
    )
  );
