-- The launch cities, kept by the owner.
--
-- Until now a city was only ever a free-text string typed into a form: a
-- customer typed it on the request, a pro typed it when choosing their service
-- area. That works for one city and falls apart for the next one, because two
-- people spell the same place two ways ("Akron, OH" and "akron oh") and the
-- lead then reaches nobody -- matching is an exact string compare.
--
-- This table is the one list of cities FixIt serves. The owner adds a city in
-- the dashboard, and both apps offer it: the customer chooses where the job is,
-- the professional chooses the areas they cover. Because both sides pick from
-- the same rows, the exact-match rule keeps working as the list grows.
--
-- The label is what everyone sees and what is stored on a request or a service
-- area, so it is the identity too: "Akron, OH". Cities are reference data, like
-- service categories, so they are public to read; only the dashboard writes.

create table if not exists public.service_cities (
  label text primary key,
  state text not null default '',
  -- 0 keeps the list in the order the owner wants it; new cities go last.
  sort_order int not null default 0,
  -- A city can be listed but not yet bookable, so the owner can prepare one
  -- before it has professionals behind it. Coming-soon cities are still shown,
  -- greyed, the way a service with no pro behind it is.
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.service_cities enable row level security;

-- Everyone reads the list: a customer choosing a city and a professional
-- choosing their service area both need it, signed in or not.
drop policy if exists "service cities are public" on public.service_cities;
create policy "service cities are public" on public.service_cities for select using (true);

-- Only the dashboard changes the list, following 0011: access is granted
-- through public.is_admin(), which 0000_admin_roles.sql defines.
drop policy if exists service_cities_admin_write on public.service_cities;
create policy service_cities_admin_write on public.service_cities
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Seed the one city the marketplace already runs in, plus the towns the seeded
-- professionals already cover, so the list starts from what the site really
-- serves rather than from nothing. Adding a row here is safe to re-run.
insert into public.service_cities (label, state, sort_order) values
  ('Akron, OH', 'OH', 1),
  ('Cuyahoga Falls, OH', 'OH', 2),
  ('Kent, OH', 'OH', 3),
  ('Stow, OH', 'OH', 4),
  ('Barberton, OH', 'OH', 5)
on conflict (label) do nothing;
