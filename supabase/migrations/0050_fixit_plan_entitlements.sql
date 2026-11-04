
-- What each plan actually gives a professional, in one place.
--
-- The plan cards promised placement, a first look at new leads and a wider
-- service area, and none of it was real: every plan behaved identically and
-- only the wording differed. That is fine while everything is free, and a
-- problem the moment a card is charged — so the differences are defined here
-- and enforced by the database, not by the page.
--
--   max_cities / max_categories   the size of the service area and the trades.
--                                 Null means no limit.
--   placement                     search position, lower first. It is a
--                                 tie-break *after* availability, so a paying
--                                 pro is never shown above one who is open now.
--   first_pick_minutes            how long a brand-new lead waits before this
--                                 plan may see it. Higher plans see it at once.
--                                 An emergency is never held back.

create or replace function public.plan_entitlements(p_plan text)
returns table (max_cities int, max_categories int, placement int, first_pick_minutes int)
language sql
immutable
as $$
  select
    -- Founding pros get Professional-level reach while they are on us: they are
    -- the cohort we most want to keep, and a thin free tier would waste the gift.
    case when p_plan in ('professional', 'founding') then 5
         when p_plan = 'business' then null
         else 1 end,
    case when p_plan in ('professional', 'founding') then 3
         when p_plan = 'business' then null
         else 1 end,
    case when p_plan = 'business' then 10
         when p_plan in ('professional', 'founding') then 20
         else 30 end,
    case when p_plan in ('business', 'professional', 'founding') then 0
         else 30 end;
$$;

revoke all on function public.plan_entitlements(text) from public;
grant execute on function public.plan_entitlements(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Enforce the service area and the trades a plan pays for.
--
-- An AFTER trigger, not BEFORE: a BEFORE row trigger cannot see the other rows
-- of the same INSERT, so a single statement adding ten cities would slip past a
-- count every time. After the row lands, the count is the real one, and the
-- whole statement is refused if it went over.
-- ---------------------------------------------------------------------------
create or replace function public.provider_areas_enforce_plan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan text;
  v_max int;
  v_count int;
begin
  select p.plan into v_plan from public.providers p where p.id = new.provider_id;
  select e.max_cities into v_max from public.plan_entitlements(coalesce(v_plan, 'default')) e;
  if v_max is null then
    return null;
  end if;
  select count(*) into v_count from public.provider_service_areas a where a.provider_id = new.provider_id;
  if v_count > v_max then
    raise exception 'Your plan covers % cit%. Upgrade to serve more places.',
      v_max, case when v_max = 1 then 'y' else 'ies' end
      using errcode = 'check_violation';
  end if;
  return null;
end;
$$;

drop trigger if exists provider_areas_enforce_plan on public.provider_service_areas;
create trigger provider_areas_enforce_plan
  after insert on public.provider_service_areas
  for each row execute function public.provider_areas_enforce_plan();

create or replace function public.provider_services_enforce_plan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan text;
  v_max int;
  v_count int;
begin
  select p.plan into v_plan from public.providers p where p.id = new.provider_id;
  select e.max_categories into v_max from public.plan_entitlements(coalesce(v_plan, 'default')) e;
  if v_max is null then
    return null;
  end if;
  select count(*) into v_count from public.provider_services s where s.provider_id = new.provider_id;
  if v_count > v_max then
    raise exception 'Your plan covers % trade%. Upgrade to offer more.',
      v_max, case when v_max = 1 then '' else 's' end
      using errcode = 'check_violation';
  end if;
  return null;
end;
$$;

drop trigger if exists provider_services_enforce_plan on public.provider_services;
create trigger provider_services_enforce_plan
  after insert on public.provider_services
  for each row execute function public.provider_services_enforce_plan();

-- ---------------------------------------------------------------------------
-- First pick: a new lead is withheld from the lower plans for a short head
-- start, so the plan that promised to see jobs first actually does. An
-- emergency is never held back — a burst pipe does not wait for a head start —
-- and a professional who already holds the lead always keeps seeing it.
-- ---------------------------------------------------------------------------
drop policy if exists "providers see matching leads" on public.quote_requests;
create policy "providers see matching leads" on public.quote_requests for select using (
  (
    exists (
      select 1
      from public.providers p
      join public.provider_services s on s.provider_id = p.id
      join public.provider_service_areas a on a.provider_id = p.id
      cross join lateral public.plan_entitlements(p.plan) e
      where p.auth_user_id = (select auth.uid())
        and s.category_slug = quote_requests.category_slug
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

