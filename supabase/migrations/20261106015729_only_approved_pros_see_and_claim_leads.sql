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
        and public.provider_offers_trade(p.id, quote_requests.category_slug)
        and a.city = quote_requests.city
    )
  )
)
with check (
  claimed_by in (select providers.id from public.providers where providers.auth_user_id = (select auth.uid()))
);
