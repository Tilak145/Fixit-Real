-- Split the dispatch query into its own statement so the result cannot be
-- narrowed by the planner: every column is selected at its declared type.
drop function if exists public.emergency_dispatch(uuid);

create function public.emergency_dispatch(p_request_id uuid)
returns table (
  provider_id uuid,
  business_name text,
  phone text,
  service_city text,
  rating double precision,
  review_count integer,
  accepting_work boolean,
  open_now boolean,
  miles double precision,
  minutes integer,
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
  today integer := extract(dow from (now() at time zone 'America/New_York'))::integer;
  minute_now integer := (extract(hour from (now() at time zone 'America/New_York')) * 60
    + extract(minute from (now() at time zone 'America/New_York')))::integer;
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
    p.id::uuid,
    coalesce(p.business_name, '')::text,
    p.phone::text,
    (select a.city::text from public.provider_service_areas a
      where a.provider_id = p.id and a.city = req.city limit 1),
    coalesce(p.rating, 0)::double precision,
    coalesce(p.review_count, 0)::integer,
    coalesce(p.accepting_work, true)::boolean,
    exists (
      select 1 from public.provider_availability v
      where v.provider_id = p.id and v.weekday = today
        and v.start_minute <= minute_now and v.end_minute > minute_now
    )::boolean as open_now,
    round(public.miles_between(p.lat, p.lng, origin_lat, origin_lng)::numeric, 1)::double precision as miles,
    case
      when public.miles_between(p.lat, p.lng, origin_lat, origin_lng) is null then null
      else greatest(3, round((public.miles_between(p.lat, p.lng, origin_lat, origin_lng) / 25 * 60 + 4)::numeric)::integer)
    end as minutes,
    exists (select 1 from public.quotes q where q.quote_request_id = req.id and q.provider_id = p.id)::boolean as has_quoted
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
