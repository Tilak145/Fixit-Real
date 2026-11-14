-- The founding offer is now one month free, not three.
--
-- The first 100 professionals still get a free period with a date on it, and
-- still pay the plan they choose when it ends. Only the length changes. This
-- replaces the function from 0049 and nothing else: the 100-place cap, the
-- one-year price lock and the trigger itself stay as they are.
--
-- Nobody held a founding place when this was written, so there is no existing
-- free period to shorten. A pro who already has an end date keeps it.
create or replace function public.providers_guard_founding()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  taken int;
begin
  if new.plan = 'founding' and (tg_op = 'INSERT' or old.plan is distinct from 'founding') then
    select count(*)::int into taken from public.providers where plan = 'founding';
    if taken >= public.founding_cap() then
      raise exception 'The free founding places are all taken.';
    end if;
    new.founding_locked_until := (now() + interval '1 year')::date;
    -- One month free from the moment the place is claimed.
    new.trial_ends_at := now() + interval '1 month';
  elsif new.plan is distinct from 'founding' then
    new.founding_locked_until := null;
    new.trial_ends_at := null;
  end if;
  return new;
end;
$$;
