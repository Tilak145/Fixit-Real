-- A professional only ever gets jobs in the trades they chose.
--
-- The rules already required a matching service, but each of them repeated its
-- own join on provider_services, and a repeat is what drifts: the dashboard's
-- list, a single job's photos, the single-job read, quoting and claiming all
-- had their own copy. This replaces every copy with one question, and then
-- closes the two ways a job could still reach a pro in another trade: quoting
-- on it, or claiming it.

-- One answer to "does this professional offer this trade?".
create or replace function public.provider_offers_trade(p_provider_id uuid, p_category text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.provider_services s
    where s.provider_id = p_provider_id
      and s.category_slug = p_category
  );
$$;

revoke all on function public.provider_offers_trade(uuid, text) from public;
grant execute on function public.provider_offers_trade(uuid, text) to authenticated;

-- The trades each pro may be shown, for the dashboard to say so plainly.
create or replace function public.my_trades()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(s.category_slug order by s.category_slug), '{}')
  from public.provider_services s
  join public.providers p on p.id = s.provider_id
  where p.auth_user_id = (select auth.uid());
$$;

revoke all on function public.my_trades() from public;
grant execute on function public.my_trades() to authenticated;

-- ---------------------------------------------------------------------------
-- The list of jobs a pro can see: their trade, their city, while accepting
-- work, plus any job already awarded to them.
-- ---------------------------------------------------------------------------
drop policy if exists "providers see matching leads" on public.quote_requests;
create policy "providers see matching leads" on public.quote_requests for select using (
  (
    exists (
      select 1
      from public.providers p
      join public.provider_service_areas a on a.provider_id = p.id
      cross join lateral public.plan_entitlements(p.plan) e
      where p.auth_user_id = (select auth.uid())
        and public.provider_offers_trade(p.id, quote_requests.category_slug)
        and a.city = quote_requests.city
        and p.accepting_work
        and (quote_requests.is_emergency = false or p.accepts_emergency)
        and (
          quote_requests.is_emergency
          or quote_requests.created_at <= now() - make_interval(mins => e.first_pick_minutes)
        )
    )
    and not public.quote_request_is_withheld(quote_requests.id)
  )
  or claimed_by in (select id from public.providers where auth_user_id = (select auth.uid()))
);

-- Opening one job directly goes through the same rule as the list.
drop policy if exists quote_request_media_matching_provider on public.quote_request_media;
create policy quote_request_media_matching_provider on public.quote_request_media
  for select to authenticated
  using (
    exists (
      select 1
      from public.quote_requests q
      join public.providers p on p.auth_user_id = (select auth.uid())
      join public.provider_service_areas a on a.provider_id = p.id and a.city = q.city
      where q.id = quote_request_id
        and public.provider_offers_trade(p.id, q.category_slug)
        and (p.accepting_work or q.claimed_by = p.id)
    )
  );

drop policy if exists request_media_read on storage.objects;
create policy request_media_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'request-media'
    and (
      exists (
        select 1 from public.quote_requests q
        where q.id::text = (storage.foldername(name))[1]
          and q.customer_user_id = (select auth.uid())
      )
      or exists (
        select 1
        from public.quote_requests q
        join public.providers p on p.auth_user_id = (select auth.uid())
        join public.provider_service_areas a on a.provider_id = p.id and a.city = q.city
        where q.id::text = (storage.foldername(name))[1]
          and public.provider_offers_trade(p.id, q.category_slug)
          and (p.accepting_work or q.claimed_by = p.id)
      )
      or (select public.is_admin())
    )
  );

-- Claiming a job: only one in the pro's own trade, in a city they serve.
drop policy if exists "claiming provider updates lead" on public.quote_requests;
create policy "claiming provider updates lead" on public.quote_requests
  for update to authenticated
  using (
    claimed_by in (select id from public.providers where auth_user_id = (select auth.uid()))
    or (
      claimed_by is null
      and exists (
        select 1 from public.providers p
        join public.provider_service_areas a on a.provider_id = p.id
        where p.auth_user_id = (select auth.uid())
          and public.provider_offers_trade(p.id, quote_requests.category_slug)
          and a.city = quote_requests.city
      )
    )
  )
  with check (
    claimed_by in (select id from public.providers where auth_user_id = (select auth.uid()))
  );

-- Quoting a job: the same trade and city, or a job already theirs.
drop policy if exists quotes_provider_insert on public.quotes;
create policy quotes_provider_insert on public.quotes
  for insert to authenticated
  with check (
    provider_id in (select id from public.providers where auth_user_id = (select auth.uid()))
    and exists (
      select 1
      from public.quote_requests q
      join public.providers p on p.auth_user_id = (select auth.uid())
      join public.provider_service_areas a on a.provider_id = p.id and a.city = q.city
      where q.id = quote_request_id
        and public.provider_offers_trade(p.id, q.category_slug)
        and (p.accepting_work or q.claimed_by = p.id)
    )
  );

-- The insert trigger that guards quoting keeps every rule it has — admin
-- repairs and the platform's own writes still pass — and adds the trade check,
-- so a price on another trade's job is refused with a sentence that says why.
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
  v_category text;
  v_accepted integer;
  v_offers boolean;
begin
  -- A write with no signed-in user is the platform's own; skip the rules.
  if v_caller is null then
    return new;
  end if;

  -- The job must exist for everyone, admin included: quoting a request that is
  -- gone is never a real action, and this is where the clear message is owed.
  select q.status, q.category_slug into v_status, v_category
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

  -- A professional may only price the trades they offer. This is the rule that
  -- keeps a roofer's work out of a plumber's hands even if a screen is wrong.
  select public.provider_offers_trade(p.id, v_category) into v_offers
  from public.providers p
  where p.id = new.provider_id;

  if coalesce(v_offers, false) is not true then
    raise exception 'This job is not one of your trades, so you cannot quote on it.'
      using errcode = 'check_violation';
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
