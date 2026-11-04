-- A professional needs to tell FixIt when they actually work, and whether they
-- take the calls that come at 11pm. Two things follow from that:
--
--   * each professional gets a weekly availability calendar (which days, and
--     the start and end time for each), shown in their dashboard;
--   * emergency requests are routed only to professionals who have opted in to
--     after-hours work. A burst pipe at midnight is no use to a pro who does
--     not answer at midnight, and the customer should not lose hope watching an
--     email go nowhere.
--
-- Times are stored as minutes from midnight (0-1439), which sorts and compares
-- exactly, carries no timezone of its own, and sidesteps the ambiguity of a
-- wall-clock string. A weekday of 0 is Sunday, matching JavaScript's getDay().

alter table public.providers
  add column if not exists accepts_emergency boolean not null default false;

-- 0019 replaced the table-level SELECT grant on quote_requests with an explicit
-- column list; providers still has a table-level grant, so the new column only
-- needs its own grant for the column list to stay honest where one is used.
grant select (accepts_emergency) on public.providers to anon, authenticated;

create table if not exists public.provider_availability (
  provider_id uuid not null references public.providers(id) on delete cascade,
  -- 0 = Sunday … 6 = Saturday.
  weekday int not null check (weekday between 0 and 6),
  start_minute int not null check (start_minute between 0 and 1439),
  end_minute int not null check (end_minute between 1 and 1440),
  updated_at timestamptz not null default now(),
  primary key (provider_id, weekday),
  -- A window must end after it starts; an overnight window is expressed as the
  -- two days it covers rather than as an end time smaller than the start.
  constraint provider_availability_window check (end_minute > start_minute)
);

alter table public.provider_availability enable row level security;

-- A professional's hours are public: a customer choosing who to hire may
-- reasonably want to know when they work.
drop policy if exists "availability readable" on public.provider_availability;
create policy "availability readable" on public.provider_availability for select using (true);

drop policy if exists "providers manage own availability" on public.provider_availability;
create policy "providers manage own availability" on public.provider_availability
  for all
  using (
    exists (select 1 from public.providers p where p.id = provider_id and p.auth_user_id = (select auth.uid()))
  )
  with check (
    exists (select 1 from public.providers p where p.id = provider_id and p.auth_user_id = (select auth.uid()))
  );

grant select on public.provider_availability to anon, authenticated;
grant insert, update, delete on public.provider_availability to authenticated;

-- Emergency leads reach only the professionals who opted in to after-hours
-- work. A professional who already holds the lead keeps seeing it whatever
-- they later change, so a claim is never taken away under them.
drop policy if exists "providers see matching leads" on public.quote_requests;
create policy "providers see matching leads" on public.quote_requests for select using (
  exists (
    select 1 from public.providers p
    join public.provider_services s on s.provider_id = p.id
    join public.provider_service_areas a on a.provider_id = p.id
    where p.auth_user_id = auth.uid()
      and s.category_slug = quote_requests.category_slug
      and a.city = quote_requests.city
      and (quote_requests.is_emergency = false or p.accepts_emergency)
  ) or claimed_by in (select id from public.providers where auth_user_id = auth.uid())
);
