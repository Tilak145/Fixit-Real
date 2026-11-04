-- A waitlist for trades with no professional behind them yet.
--
-- Roofing, Cleaning, Pest Control and Landscaping are real trades customers
-- ask for. Rather than a page that only says "coming soon", a customer can
-- leave their email and what they need, and the owner sees how much demand
-- each empty trade has — which is the number that decides who to recruit
-- next. Listing on the site does not wait for a pro: the request itself
-- remains the main way in.

create table if not exists public.service_waitlist (
  id uuid primary key default gen_random_uuid(),
  category_slug text not null,
  city text,
  email text not null,
  note text,
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  -- One entry per address per trade: asking twice does not inflate demand.
  unique (category_slug, email)
);

alter table public.service_waitlist enable row level security;

-- Anyone may join the list; only the dashboard may read who is on it.
drop policy if exists service_waitlist_join on public.service_waitlist;
create policy service_waitlist_join on public.service_waitlist
  for insert to anon, authenticated
  with check (
    position('@' in email) > 1
    and length(email) <= 254
    and exists (select 1 from public.service_categories c where c.slug = category_slug)
  );

drop policy if exists service_waitlist_admin_read on public.service_waitlist;
create policy service_waitlist_admin_read on public.service_waitlist
  for select to authenticated
  using ((select public.is_admin()));

grant select on public.service_waitlist to authenticated;
grant insert on public.service_waitlist to anon, authenticated;

-- Demand per empty trade, for the owner. A trade with approved professionals
-- is not on this list: it is served, so there is no wait to measure.
create or replace function public.service_demand()
returns table (
  category_slug text,
  category_name text,
  waiting int,
  open_requests int,
  last_asked_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select public.is_admin()) then
    raise exception 'Only dashboard staff may see demand.';
  end if;
  return query
    select
      c.slug::text,
      c.name::text,
      coalesce((select count(*)::int from public.service_waitlist w where w.category_slug = c.slug), 0),
      coalesce((select count(*)::int from public.quote_requests q where q.category_slug = c.slug and q.status <> 'completed'), 0),
      (select max(w.created_at) from public.service_waitlist w where w.category_slug = c.slug)
    from public.service_categories c
    where not exists (
      select 1
      from public.provider_services s
      join public.providers p on p.id = s.provider_id
      where s.category_slug = c.slug and p.status = 'approved'
    )
    order by
      coalesce((select count(*) from public.service_waitlist w where w.category_slug = c.slug), 0) desc,
      coalesce((select count(*) from public.quote_requests q where q.category_slug = c.slug and q.status <> 'completed'), 0) desc,
      c.sort_order asc;
end;
$$;

revoke all on function public.service_demand() from public;
grant execute on function public.service_demand() to authenticated;
