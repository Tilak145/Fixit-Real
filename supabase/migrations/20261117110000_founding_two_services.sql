-- Founding Pro covers two services.
--
-- 20261117100000 set the founding plan to one service. It is now two, the same
-- as Starter. Cities (up to 5), placement and first look at leads are unchanged.

create or replace function public.plan_entitlements(p_plan text)
returns table (max_cities int, max_categories int, placement int, first_pick_minutes int)
language sql
immutable
as $$
  select
    case when p_plan in ('professional', 'founding') then 5
         when p_plan = 'business' then null
         else 1 end,
    case when p_plan = 'professional' then 3
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
