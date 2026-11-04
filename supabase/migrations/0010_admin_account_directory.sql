-- Adding someone to the team means naming their account before it has a role,
-- and the sign-up list lives in auth.users, which the browser cannot read. This
-- returns just enough to pick the right person: an email, when they joined and
-- when they were last seen. SECURITY DEFINER with an explicit owner check, so a
-- dashboard member who is not the owner gets nothing.
--
-- Never widen this to the anon role, and keep the returned columns to these
-- three: anything more would hand out account data the dashboard does not need.

create or replace function public.admin_search_accounts(term text default '', max_rows int default 20)
returns table (user_id uuid, email text, created_at timestamptz, last_sign_in_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, u.email::text, u.created_at, u.last_sign_in_at
  from auth.users u
  where (select public.is_owner())
    and (
      coalesce(trim(term), '') = ''
      or u.email ilike '%' || trim(term) || '%'
    )
  order by u.created_at desc
  limit least(greatest(coalesce(max_rows, 20), 1), 50);
$$;

revoke all on function public.admin_search_accounts(text, int) from public;
grant execute on function public.admin_search_accounts(text, int) to authenticated;
