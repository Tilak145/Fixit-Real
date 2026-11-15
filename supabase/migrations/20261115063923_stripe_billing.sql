-- Stripe billing.
--
-- Three small tables, written only by the `billing` edge function (which runs
-- with the platform's own key, so row security below keeps everyone else out):
--
--   payment_customers      which Stripe customer is which FixIt account
--   payment_subscriptions  each subscription as Stripe last reported it
--   payment_events         the webhooks already handled, so a repeat is skipped
--
-- `livemode` keeps Stripe's test mode and live mode apart. A customer made while
-- testing does not exist once the live keys are in, so each mode has its own rows.
--
-- This also closes a gap: a pro could change their own `plan` through the API,
-- or pick Business on sign-up and never pay. From now on a signed-in pro cannot
-- change their own plan. The plan is recorded by the billing function when
-- Stripe confirms a payment, or by staff. The one thing a pro may still ask for
-- is the free founding place, which the founding guard already limits.

create table if not exists public.payment_customers (
  user_id uuid not null references auth.users (id) on delete cascade,
  livemode boolean not null,
  stripe_customer_id text not null unique,
  created_at timestamptz not null default now(),
  primary key (user_id, livemode)
);

create table if not exists public.payment_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  stripe_subscription_id text not null unique,
  stripe_customer_id text not null,
  livemode boolean not null,
  status text not null,
  plan_key text,
  price_id text,
  cancel_at_period_end boolean not null default false,
  current_period_end timestamptz,
  trial_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_subscriptions_user_idx
  on public.payment_subscriptions (user_id);

create table if not exists public.payment_events (
  id text primary key,
  type text not null,
  livemode boolean not null,
  received_at timestamptz not null default now()
);

alter table public.payment_customers enable row level security;
alter table public.payment_subscriptions enable row level security;
alter table public.payment_events enable row level security;

revoke all on public.payment_customers, public.payment_subscriptions, public.payment_events
  from anon, authenticated;
grant select on public.payment_customers, public.payment_subscriptions to authenticated;

-- A person sees only their own billing rows; the owner sees all subscriptions.
drop policy if exists payment_customers_read_own on public.payment_customers;
create policy payment_customers_read_own on public.payment_customers
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists payment_subscriptions_read_own on public.payment_subscriptions;
create policy payment_subscriptions_read_own on public.payment_subscriptions
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists payment_subscriptions_owner_read on public.payment_subscriptions;
create policy payment_subscriptions_owner_read on public.payment_subscriptions
  for select to authenticated
  using ((select public.is_owner()));

-- payment_events has no policy on purpose: nobody but the platform reads or writes it.

-- A signed-in pro cannot approve themselves, move their trial date, set their
-- own rating, or (new) change their own plan.
create or replace function public.providers_lock_staff_fields()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  if (select auth.uid()) is null or (select public.is_admin()) then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.status := 'pending';
    new.trial_ends_at := null;
    new.founding_locked_until := null;
    new.founding_trial_used := false;
  else
    new.status := old.status;
    new.trial_ends_at := old.trial_ends_at;
    new.founding_locked_until := old.founding_locked_until;
    new.founding_trial_used := old.founding_trial_used;
    -- Paid plans come from Stripe. Asking for the free founding place is
    -- still allowed; providers_guard_founding decides whether it is granted.
    if new.plan is distinct from old.plan and new.plan <> 'founding' then
      new.plan := old.plan;
    end if;
  end if;
  select coalesce(round(avg(r.rating), 2), 0), count(*)
    into new.rating, new.review_count
    from public.reviews r
   where r.provider_id = new.id;
  return new;
end;
$function$;
