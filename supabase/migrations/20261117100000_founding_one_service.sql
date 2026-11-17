-- Founding Pro covers one service.
--
-- The free founding month used to give Professional-level reach: up to 3
-- services. It now covers one service (cities, placement and first look at
-- leads are unchanged). Nobody is on the founding plan today; a founding pro
-- who later holds more than one service keeps them until their list is next
-- saved, when the database applies the new limit.

create or replace function public.plan_entitlements(p_plan text)
returns table (max_cities int, max_categories int, placement int, first_pick_minutes int)
language sql
immutable
as $$
  select
    case when p_plan in ('professional', 'founding') then 5
         when p_plan = 'business' then null
         else 1 end,
    case when p_plan = 'founding' then 1
         when p_plan = 'professional' then 3
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
