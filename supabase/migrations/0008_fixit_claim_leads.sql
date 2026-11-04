-- Accepting a lead was impossible. The original policy let a professional update
-- only rows where claimed_by was already their own id, but an unclaimed lead has
-- claimed_by = null, and `null in (...)` is never true — so the Accept action
-- matched no rows and silently claimed nothing.
--
-- A professional may now claim an unclaimed lead that matches their own services
-- and service areas, and keeps updating it once it is theirs. The SELECT policy
-- already restricts which leads are visible, so this reveals no other pro's
-- customer. Handing a lead to a different professional is still refused.

drop policy if exists "claiming provider updates lead" on public.quote_requests;
create policy "claiming provider updates lead" on public.quote_requests
  for update to authenticated
  using (
    claimed_by in (select id from public.providers where auth_user_id = (select auth.uid()))
    or (
      claimed_by is null
      and exists (
        select 1 from public.providers p
        join public.provider_services s on s.provider_id = p.id
        join public.provider_service_areas a on a.provider_id = p.id
        where p.auth_user_id = (select auth.uid())
          and s.category_slug = quote_requests.category_slug
          and a.city = quote_requests.city
      )
    )
  )
  with check (
    claimed_by in (select id from public.providers where auth_user_id = (select auth.uid()))
  );
