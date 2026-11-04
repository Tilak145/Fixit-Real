-- Access for the management dashboard: approving professionals and keeping an
-- eye on requests and reviews. Requires 0000_admin_roles.sql, which defines
-- public.is_admin().
--
-- Approval is a change of providers.status to 'approved'; the site only lists
-- approved professionals. Row Level Security still decides access, not the page.

drop policy if exists providers_admin_all on public.providers;
create policy providers_admin_all on public.providers
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists quote_requests_admin_all on public.quote_requests;
create policy quote_requests_admin_all on public.quote_requests
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists reviews_admin_all on public.reviews;
create policy reviews_admin_all on public.reviews
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
