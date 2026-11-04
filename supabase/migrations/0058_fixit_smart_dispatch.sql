-- Smart dispatching: an emergency goes to the nearest shop that can take it.
--
-- Until now an emergency was simply a lead carrying a flag: every professional
-- serving the city saw it at once, and the fastest to the phone won. That is
-- fine for a replacement tap; it is wrong for a burst pipe, where the customer
-- wants the crew five minutes away, not the one across the county.
--
-- A professional's shop is geocoded once, from the address they entered. The
-- customer's address is geocoded too, when they post the request. The two are
-- compared only to order the emergency: the customer's exact point never leaves
-- the database, and no other professional learns a competitor's location.
--
-- Standard (non-emergency) leads keep the existing city matching. Distance
-- changes the order of an emergency, never who is allowed to see a request.

alter table public.providers
  add column if not exists lat double precision,
  add column if not exists lng double precision,
  add column if not exists located_at timestamptz;

alter table public.quote_requests
  add column if not exists lat double precision,
  add column if not exists lng double precision;

-- The city itself, for a customer who typed an address the lookup could not
-- place: a job in downtown Akron still gets an Akron crew first.
alter table public.service_cities
  add column if not exists lat double precision,
  add column if not exists lng double precision;

comment on column public.providers.lat is 'Shop location, geocoded from the business address. Used only to order emergency dispatch.';
comment on column public.quote_requests.lat is 'Job location for emergency dispatch. Never returned to any professional.';

-- Straight-line miles, computed inside PostgreSQL so the precise points never
-- travel to a browser.
create or replace function public.miles_between(
  p_lat1 double precision, p_lng1 double precision,
  p_lat2 double precision, p_lng2 double precision
)
returns double precision
language sql
immutable
as $$
  select case
    when p_lat1 is null or p_lng1 is null or p_lat2 is null or p_lng2 is null then null
    when p_lat1 = p_lat2 and p_lng1 = p_lng2 then 0
    else 3958.8 * 2 * asin(sqrt(
      power(sin(radians(p_lat2 - p_lat1) / 2), 2)
      + cos(radians(p_lat1)) * cos(radians(p_lat2))
        * power(sin(radians(p_lng2 - p_lng1) / 2), 2)
    ))
  end
$$;

-- The most likely origin of a job: its own point, else its city's centre.
create or replace function public.request_origin_lat(p_request public.quote_requests)
returns double precision
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    p_request.lat,
    (select c.lat from public.service_cities c where c.label = p_request.city limit 1)
  )
$$;

create or replace function public.request_origin_lng(p_request public.quote_requests)
returns double precision
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    p_request.lng,
    (select c.lng from public.service_cities c where c.label = p_request.city limit 1)
  )
$$;

-- Ranking for an emergency: distance from the shop, then whether the shop is
-- open right now, then rating. The result is a number of miles, so the dispatch
-- screen can say "2.1 mi" instead of a score nobody can act on.
create or replace function public.provider_miles_to_request(p_provider_id uuid, p_request_id uuid)
returns double precision
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  pro public.providers;
  req public.quote_requests;
begin
  if not (select public.is_admin()) and not exists (
    select 1 from public.providers p
    where p.id = p_provider_id and p.auth_user_id = (select auth.uid())
  ) then
    raise exception 'You may only see the distance to your own jobs.';
  end if;
  select * into pro from public.providers where id = p_provider_id;
  select * into req from public.quote_requests where id = p_request_id;
  if pro.id is null or req.id is null then return null; end if;
  return round(public.miles_between(
    pro.lat, pro.lng,
    public.request_origin_lat(req), public.request_origin_lng(req)
  )::numeric, 1);
end;
$$;

revoke all on function public.provider_miles_to_request(uuid, uuid) from public;
grant execute on function public.provider_miles_to_request(uuid, uuid) to authenticated;

-- Who to send an emergency to, nearest first. Owners and staff use this from
-- the dashboard: the person taking the call can see the two closest crews and
-- hand the job to one of them with a reason, rather than letting it sit.
create or replace function public.emergency_dispatch(p_request_id uuid)
returns table (
  provider_id uuid,
  business_name text,
  phone text,
  city text,
  rating numeric,
  review_count int,
  accepting_work boolean,
  open_now boolean,
  miles double precision,
  minutes int,
  has_quoted boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  req public.quote_requests;
  origin_lat double precision;
  origin_lng double precision;
begin
  if not (select public.is_admin()) then
    raise exception 'Only dashboard staff may dispatch an emergency.';
  end if;
  select * into req from public.quote_requests where id = p_request_id;
  if req.id is null then return; end if;
  origin_lat := public.request_origin_lat(req);
  origin_lng := public.request_origin_lng(req);
  return query
    select
      p.id,
      p.business_name,
      p.phone,
      (select a.city from public.provider_service_areas a where a.provider_id = p.id and a.city = req.city limit 1),
      p.rating::numeric,
      p.review_count,
      coalesce(p.accepting_work, true),
      exists (
        select 1 from public.provider_availability v
        where v.provider_id = p.id
          and v.weekday = extract(dow from (now() at time zone 'America/New_York'))::int
          and v.start_minute <= (extract(hour from (now() at time zone 'America/New_York')) * 60
              + extract(minute from (now() at time zone 'America/New_York')))::int
          and v.end_minute > (extract(hour from (now() at time zone 'America/New_York')) * 60
              + extract(minute from (now() at time zone 'America/New_York')))::int
      ) as open_now,
      round(public.miles_between(p.lat, p.lng, origin_lat, origin_lng)::numeric, 1) as miles,
      case
        when public.miles_between(p.lat, p.lng, origin_lat, origin_lng) is null then null
        else greatest(3, round((public.miles_between(p.lat, p.lng, origin_lat, origin_lng) / 25 * 60 + 4)::numeric)::int)
      end as minutes,
      exists (select 1 from public.quotes q where q.quote_request_id = req.id and q.provider_id = p.id) as has_quoted
    from public.providers p
    where p.status = 'approved'
      and p.accepts_emergency
      and exists (select 1 from public.provider_services s where s.provider_id = p.id and s.category_slug = req.category_slug)
      and exists (select 1 from public.provider_service_areas a where a.provider_id = p.id and a.city = req.city)
    order by
      (public.miles_between(p.lat, p.lng, origin_lat, origin_lng) is null) asc,
      public.miles_between(p.lat, p.lng, origin_lat, origin_lng) asc,
      coalesce(p.accepting_work, true) desc,
      p.rating desc nulls last
    limit 8;
end;
$$;

revoke all on function public.emergency_dispatch(uuid) from public;
grant execute on function public.emergency_dispatch(uuid) to authenticated;

-- Requests the pro may see are unchanged. What changes is the order a pro sees
-- them in: an emergency they are nearest to sits above the rest, and the list
-- can say how far it is without exposing the address.
create or replace function public.my_lead_distance(p_request_id uuid)
returns double precision
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  pro public.providers;
  req public.quote_requests;
begin
  select * into pro from public.providers where auth_user_id = (select auth.uid()) limit 1;
  if pro.id is null then return null; end if;
  select * into req from public.quote_requests where id = p_request_id;
  if req.id is null then return null; end if;
  return round(public.miles_between(
    pro.lat, pro.lng,
    public.request_origin_lat(req), public.request_origin_lng(req)
  )::numeric, 1);
end;
$$;

revoke all on function public.my_lead_distance(uuid) from public;
grant execute on function public.my_lead_distance(uuid) to authenticated;
