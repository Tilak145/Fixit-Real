
-- The founding offer, time-boxed: the first 100 professionals get three months
-- free, then they pay the plan they choose.
--
-- The previous offer was free for good, with a price locked for a year. That
-- was honest while the marketplace had no leads to sell, but it gave the first
-- cohort no reason to ever convert. Three months free is a trial with a date on
-- it: long enough to see real work come in, short enough that the pro has to
-- decide whether FixIt earns its keep.
--
-- Why this is tracked here and not by Stripe: the payment layer's checkout
-- refuses a trial parameter (Stripe's own 'trial_period_days' comes back as a
-- validation error), so FixIt cannot hand Stripe a card and a 90-day trial and
-- let it charge on day 91. What the product can do honestly is record when each
-- free period ends, show the professional the date and what it costs next, and
-- ask them to start their plan when it arrives. Nobody is charged silently, and
-- nobody is surprised.

-- When this professional's free period ends. Null once they are on a paid plan
-- or if they never took a founding place.
alter table public.providers
  add column if not exists trial_ends_at timestamptz;

-- How many free founding places there are. One number, in one place: 100.
create or replace function public.founding_cap()
returns int
language sql
immutable
as $$ select 100 $$;

-- Stamp the free period when a founding place is taken, and clear the trial
-- date when they move to a paid plan (their free period is over either way).
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
    -- Three months free from the moment the place is claimed.
    new.trial_ends_at := now() + interval '3 months';
  elsif new.plan is distinct from 'founding' then
    new.founding_locked_until := null;
    new.trial_ends_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists providers_guard_founding on public.providers;
create trigger providers_guard_founding
  before insert or update on public.providers
  for each row execute function public.providers_guard_founding();

-- Backfill: anyone already on the founding plan gets three months from now, so
-- the one existing founding pro is not left without a date.
update public.providers
set trial_ends_at = now() + interval '3 months'
where plan = 'founding' and trial_ends_at is null;

-- The cohort, for the owner: who is on a free place and when each one ends.
create or replace function public.founding_cohort()
returns table (
  provider_id uuid,
  business_name text,
  joined_at timestamptz,
  trial_ends_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.business_name, p.created_at, p.trial_ends_at
  from public.providers p
  where p.plan = 'founding'
  order by p.created_at asc;
$$;

revoke all on function public.founding_cohort() from public;
grant execute on function public.founding_cohort() to authenticated;

