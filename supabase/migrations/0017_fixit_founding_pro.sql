-- A brand-new marketplace has no leads to sell yet, so the first professionals
-- are not charged for a promise of volume. "Founding Pro" is free for a capped
-- number of them, with the price they will pay later locked for a year.
--
-- The cap is enforced by the database, not by the page: without that, a page
-- bug (or a script) could hand out unlimited free accounts.

alter table public.providers
  drop constraint if exists providers_plan_check;

alter table public.providers
  add constraint providers_plan_check
  check (plan in ('founding', 'starter', 'professional', 'business'));

-- When the founding price lock runs out. Set the moment someone becomes a
-- founding pro, cleared if they move to a paid plan.
alter table public.providers
  add column if not exists founding_locked_until date;

-- How many free founding places there are. One number, in one place.
create or replace function public.founding_cap()
returns int
language sql
immutable
as $$ select 25 $$;

-- How many are left. Readable without signing in: the sign-up page shows the
-- remaining places before anyone creates an account.
create or replace function public.founding_slots_left()
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(
    0,
    public.founding_cap() - (select count(*)::int from public.providers where plan = 'founding')
  );
$$;

revoke all on function public.founding_slots_left() from public;
grant execute on function public.founding_slots_left() to anon, authenticated;

-- Refuse a new founding sign-up once the cap is reached, and stamp the lock.
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
      raise exception 'The free Founding Pro places are all taken.';
    end if;
    new.founding_locked_until := (now() + interval '1 year')::date;
  elsif new.plan is distinct from 'founding' then
    new.founding_locked_until := null;
  end if;
  return new;
end;
$$;

drop trigger if exists providers_guard_founding on public.providers;
create trigger providers_guard_founding
  before insert or update on public.providers
  for each row execute function public.providers_guard_founding();
