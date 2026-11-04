-- The management dashboard also watches scheduled visits and message threads.
-- Same pattern as 0004: access is granted through public.is_admin(), which
-- 0000_admin_roles.sql defines.

drop policy if exists appointments_admin_all on public.appointments;
create policy appointments_admin_all on public.appointments
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists messages_admin_all on public.messages;
create policy messages_admin_all on public.messages
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
