
-- Correct the Starter trade limit.
--
-- 0050 gave Starter a single category, but the seeded professionals already
-- offer two trades, and the onboarding wizard rewrites the whole list on every
-- save — so the limit would have refused a Starter pro the very next time they
-- touched their profile. Starter covers two trades, which is also what the
-- price implies. Nothing else changes.

create or replace function public.plan_entitlements(p_plan text)
returns table (max_cities int, max_categories int, placement int, first_pick_minutes int)
language sql
immutable
as $$
  select
    case when p_plan in ('professional', 'founding') then 5
         when p_plan = 'business' then null
         else 1 end,
    case when p_plan in ('professional', 'founding') then 3
         when p_plan = 'business' then null
         else 2 end,
    case when p_plan = 'business' then 10
         when p_plan in ('professional', 'founding') then 20
         else 30 end,
    case when p_plan in ('business', 'professional', 'founding') then 0
         else 30 end;
$$;

revoke all on function public.plan_entitlements(text) from public;
grant execute on function public.plan_entitlements(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Placement, exposed for the customer-facing search.
--
-- The home and service pages rank by availability and rating today; a paying
-- plan should also carry the placement it bought. This view gives the public
-- search the two numbers it needs — the plan's placement and the service area —
-- without exposing anything private about the professional.
-- ---------------------------------------------------------------------------
drop view if exists public.provider_placement;
create view public.provider_placement as
select
  p.id as provider_id,
  e.placement,
  coalesce((
    select array_agg(a.city)
    from public.provider_service_areas a
    where a.provider_id = p.id
  ), '{}') as cities
from public.providers p
cross join lateral public.plan_entitlements(p.plan) e
where p.status = 'approved';

grant select on public.provider_placement to anon, authenticated;

