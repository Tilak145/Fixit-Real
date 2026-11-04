-- Who may use the management dashboard. Apply this once, before the dashboard
-- is wired up; adding an admin is one insert into this table.

create table if not exists public.app_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'admin' check (role in ('admin')),
  created_at timestamptz not null default now()
);

alter table public.app_roles enable row level security;

-- A signed-in user reads only their own row. The dashboard checks this before
-- it renders. Keep this policy off is_admin(): a policy on app_roles that
-- queries app_roles recurses.
drop policy if exists app_roles_self_read on public.app_roles;
create policy app_roles_self_read on public.app_roles
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Business tables call this from their own policies. SECURITY DEFINER runs the
-- lookup outside the caller's row security, so granting admins full access to a
-- table never re-enters the policy above.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.app_roles where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- Give a business table to the dashboard with one policy per table. The
-- (select ...) wrapper matters: Postgres then evaluates is_admin() once per
-- statement instead of once per row.
--
--   create policy orders_admin_all on public.orders
--     for all to authenticated
--     using ((select public.is_admin()))
--     with check ((select public.is_admin()));
