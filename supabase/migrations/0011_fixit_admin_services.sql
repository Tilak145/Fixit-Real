-- The dashboard also keeps the service catalogue: the list of trades and jobs
-- customers pick from when they post a request. Categories are public to read,
-- so this only adds the write side for the dashboard, following 0004: access is
-- granted through public.is_admin(), which 0000_admin_roles.sql defines.
--
-- Deleting a category would strand the requests that reference it, so the
-- foreign keys already refuse that; the dashboard shows the error as-is.

drop policy if exists service_categories_admin_write on public.service_categories;
create policy service_categories_admin_write on public.service_categories
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
