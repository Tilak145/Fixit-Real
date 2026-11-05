-- can_open must only ever say yes to people who work here.
--
-- 0066 treated "no saved choice of screens" as "may open anything". But a person
-- with no app_roles row also has no saved choice, so everybody passed, including
-- visitors who are not signed in. That left the licence, insurance and business
-- registration checks open to anyone.
--
-- It also let staff with no saved choice open owner-only screens. 0066 says those
-- staff keep the standard staff list, so they now get exactly that.

create or replace function public.can_open(p_screen text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select public.is_owner()) then
    return true;
  end if;
  if not (select public.is_admin()) then
    return false;
  end if;
  return p_screen = any (
    coalesce((select public.my_staff_permissions()), public.default_staff_permissions())
  );
end;
$$;
