-- The dispatch query returns rating as the column's own type, so the function
-- must declare it that way rather than as numeric. The result shape changes,
-- so the old function is dropped first.
drop function if exists public.emergency_dispatch(uuid);

create or replace function public.emergency_dispatch(p_request_id uuid)
returns table (
  provider_id uuid,
  business_name text,
  phone text,
  service_city text,
  rating real,
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
      p.business_name::text,
      p.phone::text,
      (select a.city::text from public.provider_service_areas a where a.provider_id = p.id and a.city = req.city limit 1),
      p.rating,
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
      ),
      round(public.miles_between(p.lat, p.lng, origin_lat, origin_lng)::numeric, 1)::double precision,
      case
        when public.miles_between(p.lat, p.lng, origin_lat, origin_lng) is null then null
        else greatest(3, round((public.miles_between(p.lat, p.lng, origin_lat, origin_lng) / 25 * 60 + 4)::numeric)::int)
      end,
      exists (select 1 from public.quotes q where q.quote_request_id = req.id and q.provider_id = p.id)
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
