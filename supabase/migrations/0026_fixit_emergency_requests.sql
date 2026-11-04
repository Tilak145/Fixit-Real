-- A customer can flag a request as an emergency: water pouring through a
-- ceiling cannot wait for a callback tomorrow. The flag is set by the customer
-- on the request form (and offered by Smart Assist when their own words read
-- as urgent), and it is what lets a professional see, at a glance, which of
-- today's leads needs to be answered first.

alter table public.quote_requests
  add column if not exists is_emergency boolean not null default false;

-- 0019 replaced the table-level SELECT grant with an explicit column list, so a
-- new column is invisible to the API until it is granted here.
grant select (is_emergency) on public.quote_requests to anon, authenticated;

-- Emergency leads are the ones pros should see first in a list sorted by time.
create index if not exists quote_requests_emergency_idx
  on public.quote_requests (is_emergency desc, created_at desc);
