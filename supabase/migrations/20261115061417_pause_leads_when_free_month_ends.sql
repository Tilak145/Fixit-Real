-- Already applied to the live database on 2026-11-15, outside this project.
-- Saved here so the project matches the database.

-- True when a pro's free month is over and they have not started a paid plan.
create or replace function public.provider_leads_paused(p_plan text, p_trial_ends_at timestamptz)
 returns boolean
 language sql
 stable
 set search_path to ''
as $function$
  select p_plan = 'founding' and p_trial_ends_at is not null and p_trial_ends_at <= now();
$function$;

drop policy if exists "providers see matching leads" on public.quote_requests;
create policy "providers see matching leads" on public.quote_requests
for select using (
  (
    exists (
      select 1
      from public.providers p
      join public.provider_service_areas a on a.provider_id = p.id
      cross join lateral public.plan_entitlements(p.plan) e(max_cities, max_categories, placement, first_pick_minutes)
      where p.auth_user_id = (select auth.uid())
        and p.status = 'approved'
        and not public.provider_leads_paused(p.plan, p.trial_ends_at)
        and public.provider_offers_trade(p.id, quote_requests.category_slug)
        and a.city = quote_requests.city
        and p.accepting_work
        and (quote_requests.is_emergency = false or p.accepts_emergency)
        and (quote_requests.is_emergency or quote_requests.created_at <= now() - make_interval(mins => e.first_pick_minutes))
    )
    and not public.quote_request_is_withheld(id)
  )
  or claimed_by in (select providers.id from public.providers where providers.auth_user_id = (select auth.uid()))
);

drop policy if exists "claiming provider updates lead" on public.quote_requests;
create policy "claiming provider updates lead" on public.quote_requests
for update using (
  claimed_by in (select providers.id from public.providers where providers.auth_user_id = (select auth.uid()))
  or (
    claimed_by is null
    and exists (
      select 1
      from public.providers p
      join public.provider_service_areas a on a.provider_id = p.id
      where p.auth_user_id = (select auth.uid())
        and p.status = 'approved'
        and not public.provider_leads_paused(p.plan, p.trial_ends_at)
        and public.provider_offers_trade(p.id, quote_requests.category_slug)
        and a.city = quote_requests.city
    )
  )
)
with check (
  claimed_by in (select providers.id from public.providers where providers.auth_user_id = (select auth.uid()))
);

-- Messages now say what really happens.
create or replace function public.trial_reminder_message(p_business text, p_end timestamp with time zone, p_plan text, p_price integer)
 returns text
 language plpgsql
 stable
as $function$
declare
  plan_label text := initcap(case when coalesce(p_plan, 'founding') = 'founding' then 'professional' else p_plan end);
  money text := '$' || p_price || ' a month';
  ends text := to_char(p_end at time zone 'America/New_York', 'FMMonth FMDD, YYYY');
  left_days int := greatest(0, ceil(extract(epoch from (p_end - now())) / 86400))::int;
begin
  if p_end is null then return ''; end if;
  if p_end <= now() then
    return 'Your free period ended on ' || ends || '. Your profile is still visible, but new leads are paused. '
      || 'Start a plan from your Plan page to get leads again.';
  end if;
  if p_end <= now() + interval '14 days' then
    return 'Heads up, ' || coalesce(p_business, 'there') || ': your Founding Pro free period ends on ' || ends
      || ' (' || left_days || case when left_days = 1 then ' day' else ' days' end || ' left). '
      || 'Nothing is charged automatically. To keep getting leads after that date, ' || plan_label || ' is ' || money
      || ' — start it from your Plan page. If you do nothing, your profile stays visible but new leads pause.';
  end if;
  return 'You are in your free period, until ' || ends || '. After that, ' || plan_label || ' is ' || money || '.';
end;
$function$;
