-- Which professionals actually pay.
--
-- The home page's featured spots go only to professionals with a live paid
-- subscription. The subscription table is private (each person reads their own
-- row), so the public site asks this function instead. It returns only the
-- ids of professionals whose subscription is active or in its paid trial, and
-- nothing else about it.

create or replace function public.paying_provider_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select distinct p.id
  from public.providers p
  join public.payment_subscriptions s on s.user_id = p.auth_user_id
  where s.status in ('active', 'trialing')
$$;

revoke all on function public.paying_provider_ids() from public;
grant execute on function public.paying_provider_ids() to anon, authenticated;
