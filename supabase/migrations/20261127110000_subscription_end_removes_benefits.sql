-- When a pro's subscription ends (cancelled, or left unpaid) and they have no
-- other active one, the paid benefits stop:
--   * no new leads and no lead alerts,
--   * search placement drops to the lowest paid level (never featured, because
--     featured spots already require a live subscription),
--   * the dashboard asks them to choose a plan again.
-- Paying again switches everything back on. A failed card that Stripe is still
-- retrying (past_due) is left alone.

alter table public.providers add column if not exists billing_lapsed_at timestamptz;
grant select (billing_lapsed_at) on table public.providers to authenticated;

-- Only the billing system and staff may set or clear it.
create or replace function public.providers_lock_billing_lapse()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or (select public.is_admin()) then
    return new;
  end if;
  new.billing_lapsed_at := case when tg_op = 'INSERT' then null else old.billing_lapsed_at end;
  return new;
end;
$$;
revoke all on function public.providers_lock_billing_lapse() from public, anon, authenticated;
drop trigger if exists providers_b_lock_billing_lapse on public.providers;
create trigger providers_b_lock_billing_lapse
  before insert or update on public.providers
  for each row execute function public.providers_lock_billing_lapse();

create or replace function public.apply_subscription_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not new.livemode or new.user_id is null then
    return new;
  end if;
  if new.status in ('active', 'trialing') then
    update public.providers set billing_lapsed_at = null
    where auth_user_id = new.user_id and billing_lapsed_at is not null;
  elsif new.status in ('canceled', 'unpaid') and not exists (
    select 1 from public.payment_subscriptions s
    where s.user_id = new.user_id and s.livemode and s.status in ('active', 'trialing', 'past_due')
      and s.stripe_subscription_id <> new.stripe_subscription_id
  ) then
    update public.providers set billing_lapsed_at = now(), plan = 'starter'
    where auth_user_id = new.user_id and plan <> 'founding' and billing_lapsed_at is null;
  end if;
  return new;
end;
$$;
revoke all on function public.apply_subscription_status() from public, anon, authenticated;
drop trigger if exists payment_subscriptions_apply_status on public.payment_subscriptions;
create trigger payment_subscriptions_apply_status
  after insert or update of status on public.payment_subscriptions
  for each row execute function public.apply_subscription_status();

-- Add the same condition to the two places that hand out leads, keeping
-- everything else about them exactly as it is.
do $$
declare
  v_qual text;
  v_new text;
  v_fn text;
begin
  select qual into v_qual from pg_policies
  where schemaname = 'public' and tablename = 'quote_requests' and policyname = 'providers see matching leads';
  if position('billing_lapsed_at' in v_qual) = 0 then
    v_new := regexp_replace(v_qual, '(\(NOT (public\.)?provider_leads_paused\(p\.plan, p\.trial_ends_at\)\))', '\1 AND (p.billing_lapsed_at IS NULL)');
    if v_new = v_qual then
      raise exception 'Could not add the condition to the leads rule.';
    end if;
    execute 'alter policy "providers see matching leads" on public.quote_requests using (' || v_new || ')';
  end if;

  select pg_get_functiondef('public.queue_lead_alerts()'::regprocedure) into v_fn;
  if position('billing_lapsed_at' in v_fn) = 0 then
    v_new := replace(v_fn, 'and p.accepting_work', 'and p.accepting_work and p.billing_lapsed_at is null');
    if v_new = v_fn then
      raise exception 'Could not add the condition to the lead alerts.';
    end if;
    execute v_new;
  end if;
end $$;

-- Subscriptions that had already ended before this rule existed.
update public.providers p set billing_lapsed_at = now(), plan = 'starter'
where p.plan <> 'founding' and p.billing_lapsed_at is null
  and exists (select 1 from public.payment_subscriptions s where s.user_id = p.auth_user_id and s.livemode and s.status in ('canceled', 'unpaid'))
  and not exists (select 1 from public.payment_subscriptions s where s.user_id = p.auth_user_id and s.livemode and s.status in ('active', 'trialing', 'past_due'));
