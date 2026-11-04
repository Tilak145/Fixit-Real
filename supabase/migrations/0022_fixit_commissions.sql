-- Commission and lead-allowance accounting.
--
-- The product rule: a plan includes a number of commission-free leads each
-- calendar month; completed jobs beyond that carry a commission (default 10%,
-- capped at $250), charged on the job subtotal excluding sales tax and anything
-- refunded. Cancelled and uncompleted jobs are never charged.
--
-- Two things this must never do, because both are the kind of bug that loses a
-- contractor's trust and cannot be undone:
--
--   * count the same lead twice for one contractor, or charge the same job
--     twice. Both are prevented by unique keys, not by application code.
--   * hand out a fresh allowance because someone switched plans, cancelled and
--     reactivated, or renewed. The allowance period is the calendar month, which
--     does not move when any of those happen, so usage on the 3rd is still
--     usage on the 4th however the billing changed in between.
--
-- Commission collection itself is not wired to a payment provider here; see the
-- note at the bottom of this file.

-- ---------------------------------------------------------------------------
-- Settings: rate, cap and included leads, per plan, changeable by management.
-- ---------------------------------------------------------------------------
create table if not exists public.commission_settings (
  -- 'default' applies to any plan without its own row.
  plan_key text primary key,
  commission_rate_bps integer not null default 1000
    check (commission_rate_bps between 0 and 10000),
  -- null means there is no cap.
  commission_cap_cents bigint
    check (commission_cap_cents is null or commission_cap_cents >= 0),
  included_leads integer not null default 0 check (included_leads >= 0),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

insert into public.commission_settings (plan_key, commission_rate_bps, commission_cap_cents, included_leads)
values
  ('default',      1000, 25000, 0),
  ('founding',     1000, 25000, 25),
  ('starter',      1000, 25000, 10),
  ('professional', 1000, 25000, 25),
  ('business',     1000, 25000, 25)
on conflict (plan_key) do nothing;

alter table public.commission_settings enable row level security;

-- The terms are public: a contractor must be able to read the rate and cap
-- before they choose a plan, which includes before they have an account.
drop policy if exists commission_settings_public_read on public.commission_settings;
create policy commission_settings_public_read on public.commission_settings
  for select to anon, authenticated
  using (true);

drop policy if exists commission_settings_admin_write on public.commission_settings;
create policy commission_settings_admin_write on public.commission_settings
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

grant select on public.commission_settings to anon, authenticated;
grant insert, update, delete on public.commission_settings to authenticated;

-- ---------------------------------------------------------------------------
-- Lead ledger: one row per (lead, contractor), written once, kept forever.
-- ---------------------------------------------------------------------------
create table if not exists public.lead_ledger (
  id uuid primary key default gen_random_uuid(),
  quote_request_id uuid not null references public.quote_requests(id) on delete cascade,
  provider_id uuid not null references public.providers(id) on delete cascade,
  -- The plan the contractor was on when the lead was counted.
  plan_key text not null,
  -- First day of the calendar month the lead counts against.
  allowance_period date not null,
  allowance_status text not null check (allowance_status in ('included', 'commissionable')),
  -- The rate and cap agreed at the time, so a later settings change cannot
  -- rewrite the terms of a lead already counted.
  rate_bps integer not null,
  cap_cents bigint,
  counted_at timestamptz not null default now(),
  -- The same lead can never be counted twice for one contractor.
  unique (quote_request_id, provider_id)
);

create index if not exists lead_ledger_provider_period_idx
  on public.lead_ledger (provider_id, allowance_period);
create index if not exists lead_ledger_recent_idx on public.lead_ledger (counted_at desc);

alter table public.lead_ledger enable row level security;

drop policy if exists lead_ledger_own on public.lead_ledger;
create policy lead_ledger_own on public.lead_ledger
  for select to authenticated
  using (provider_id in (select id from public.providers where auth_user_id = (select auth.uid())));

drop policy if exists lead_ledger_admin on public.lead_ledger;
create policy lead_ledger_admin on public.lead_ledger
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Rows are written by the trigger below, never by a client.
grant select on public.lead_ledger to authenticated;

-- The settings that apply to a plan, falling back to 'default'.
create or replace function public.commission_for_plan(p_plan text)
returns table (rate_bps integer, cap_cents bigint, included_leads integer)
language sql
stable
security definer
set search_path = ''
as $$
  select s.commission_rate_bps, s.commission_cap_cents, s.included_leads
  from public.commission_settings s
  where s.plan_key = coalesce(
    (select c.plan_key from public.commission_settings c where c.plan_key = p_plan),
    'default'
  );
$$;

revoke all on function public.commission_for_plan(text) from public;
grant execute on function public.commission_for_plan(text) to authenticated;

-- Counting happens the moment a lead is accepted. Security definer so the
-- insert succeeds regardless of the caller's own grants, and so the allowance
-- decision cannot be influenced from the client.
create or replace function public.record_lead_usage()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_provider uuid;
  v_plan text;
  v_period date;
  v_used integer;
  v_rate integer;
  v_cap bigint;
  v_included integer;
  v_status text;
begin
  if new.claimed_by is null then
    return new;
  end if;
  -- Only a change of owner counts; a plain edit of the same lead does not.
  if tg_op = 'UPDATE' and old.claimed_by is not distinct from new.claimed_by then
    return new;
  end if;

  v_provider := new.claimed_by;
  select p.plan into v_plan from public.providers p where p.id = v_provider;
  if v_plan is null then
    return new;
  end if;

  v_period := date_trunc('month', now())::date;

  select rate_bps, cap_cents, included_leads
    into v_rate, v_cap, v_included
    from public.commission_for_plan(v_plan);

  -- Usage already counted this month. Because the month is fixed, switching
  -- plans or reactivating inside the same month leaves this number alone.
  select count(*) into v_used
    from public.lead_ledger l
   where l.provider_id = v_provider
     and l.allowance_period = v_period;

  v_status := case when v_used < v_included then 'included' else 'commissionable' end;

  insert into public.lead_ledger
    (quote_request_id, provider_id, plan_key, allowance_period, allowance_status, rate_bps, cap_cents)
  values
    (new.id, v_provider, v_plan, v_period, v_status, v_rate, v_cap)
  on conflict (quote_request_id, provider_id) do nothing;

  return new;
end;
$$;

revoke all on function public.record_lead_usage() from public;

drop trigger if exists record_lead_usage on public.quote_requests;
create trigger record_lead_usage
  after insert or update of claimed_by on public.quote_requests
  for each row execute function public.record_lead_usage();

-- ---------------------------------------------------------------------------
-- Job reports: the contractor says what happened and what it was worth.
-- ---------------------------------------------------------------------------
create table if not exists public.job_reports (
  id uuid primary key default gen_random_uuid(),
  -- One report per counted lead, so a job cannot be billed twice.
  lead_ledger_id uuid not null unique references public.lead_ledger(id) on delete cascade,
  provider_id uuid not null references public.providers(id) on delete cascade,
  quote_request_id uuid not null references public.quote_requests(id) on delete cascade,
  outcome text not null check (outcome in ('completed', 'not_completed', 'cancelled')),
  -- What the customer was charged for the work, before tax.
  job_subtotal_cents bigint not null default 0 check (job_subtotal_cents >= 0),
  sales_tax_cents bigint not null default 0 check (sales_tax_cents >= 0),
  -- Money given back, which reduces what the commission is charged on.
  refunded_cents bigint not null default 0 check (refunded_cents >= 0),
  completed_on date,
  reported_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'disputed', 'rejected')),
  verification_note text,
  verified_at timestamptz,
  verified_by uuid
);

create index if not exists job_reports_provider_idx
  on public.job_reports (provider_id, reported_at desc);
create index if not exists job_reports_status_idx
  on public.job_reports (verification_status, reported_at desc);

alter table public.job_reports enable row level security;

drop policy if exists job_reports_own_read on public.job_reports;
create policy job_reports_own_read on public.job_reports
  for select to authenticated
  using (provider_id in (select id from public.providers where auth_user_id = (select auth.uid())));

-- A contractor files and corrects their own report, and only ever as an
-- unverified claim: the verification columns are management's to set.
drop policy if exists job_reports_own_write on public.job_reports;
create policy job_reports_own_write on public.job_reports
  for insert to authenticated
  with check (
    provider_id in (select id from public.providers where auth_user_id = (select auth.uid()))
    and verification_status = 'pending'
  );

drop policy if exists job_reports_own_update on public.job_reports;
create policy job_reports_own_update on public.job_reports
  for update to authenticated
  using (provider_id in (select id from public.providers where auth_user_id = (select auth.uid())))
  with check (
    provider_id in (select id from public.providers where auth_user_id = (select auth.uid()))
    and verification_status = 'pending'
  );

drop policy if exists job_reports_admin on public.job_reports;
create policy job_reports_admin on public.job_reports
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

grant select, insert, update on public.job_reports to authenticated;

-- Editing a report returns it to the queue for checking.
create or replace function public.job_reports_touch()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' and row(new.outcome, new.job_subtotal_cents, new.sales_tax_cents, new.refunded_cents, new.completed_on)
       is distinct from
       row(old.outcome, old.job_subtotal_cents, old.sales_tax_cents, old.refunded_cents, old.completed_on) then
    new.verification_status := 'pending';
    new.verification_note := null;
    new.verified_at := null;
    new.verified_by := null;
  end if;
  return new;
end;
$$;

revoke all on function public.job_reports_touch() from public;

drop trigger if exists job_reports_touch on public.job_reports;
create trigger job_reports_touch
  before update on public.job_reports
  for each row execute function public.job_reports_touch();

-- ---------------------------------------------------------------------------
-- Commissions: the charge itself, one per verified completed job.
-- ---------------------------------------------------------------------------
create table if not exists public.commissions (
  id uuid primary key default gen_random_uuid(),
  -- Unique: a job is charged once, however often it is re-verified.
  job_report_id uuid not null unique references public.job_reports(id) on delete cascade,
  provider_id uuid not null references public.providers(id) on delete cascade,
  plan_key text not null,
  -- subtotal minus refunds; sales tax is never part of this.
  base_cents bigint not null,
  rate_bps integer not null,
  amount_cents bigint not null,
  cap_applied boolean not null default false,
  status text not null default 'pending'
    check (status in ('pending', 'payable', 'paid', 'waived', 'void')),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  -- The provider's reference for the payment that settled this commission.
  payment_reference text
);

create index if not exists commissions_provider_idx
  on public.commissions (provider_id, created_at desc);
create index if not exists commissions_status_idx on public.commissions (status, created_at desc);

alter table public.commissions enable row level security;

drop policy if exists commissions_own_read on public.commissions;
create policy commissions_own_read on public.commissions
  for select to authenticated
  using (provider_id in (select id from public.providers where auth_user_id = (select auth.uid())));

drop policy if exists commissions_admin on public.commissions;
create policy commissions_admin on public.commissions
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

grant select on public.commissions to authenticated;
grant update on public.commissions to authenticated;

/**
 * The commission on a completed job: rate applied to the subtotal after
 * refunds, never including sales tax, and never above the cap.
 */
create or replace function public.commission_amount(
  p_subtotal_cents bigint,
  p_refunded_cents bigint,
  p_rate_bps integer,
  p_cap_cents bigint
)
returns table (base_cents bigint, amount_cents bigint, cap_applied boolean)
language sql
immutable
as $$
  with base as (
    select greatest(coalesce(p_subtotal_cents, 0) - coalesce(p_refunded_cents, 0), 0) as b
  ), raw as (
    select b, floor(b * coalesce(p_rate_bps, 0) / 10000.0)::bigint as a from base
  )
  select
    b,
    case when p_cap_cents is not null and a > p_cap_cents then p_cap_cents else a end,
    (p_cap_cents is not null and a > p_cap_cents)
  from raw;
$$;

grant execute on function public.commission_amount(bigint, bigint, integer, bigint) to authenticated;

/**
 * Keep the commission row in step with the report. A verified completed job has
 * one commission; anything else has none. Written as an upsert on the report id
 * so re-verifying updates the same charge instead of adding a second one.
 */
create or replace function public.sync_job_commission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rate integer;
  v_cap bigint;
  v_plan text;
  v_base bigint;
  v_amount bigint;
  v_capped boolean;
begin
  if new.outcome = 'completed' and new.verification_status = 'verified' then
    select p.plan into v_plan from public.providers p where p.id = new.provider_id;
    select rate_bps, cap_cents into v_rate, v_cap from public.commission_for_plan(coalesce(v_plan, 'default'));

    select base_cents, amount_cents, cap_applied
      into v_base, v_amount, v_capped
      from public.commission_amount(new.job_subtotal_cents, new.refunded_cents, v_rate, v_cap);

    insert into public.commissions
      (job_report_id, provider_id, plan_key, base_cents, rate_bps, amount_cents, cap_applied)
    values
      (new.id, new.provider_id, coalesce(v_plan, 'default'), v_base, v_rate, v_amount, v_capped)
    on conflict (job_report_id) do update
      set base_cents = excluded.base_cents,
          rate_bps = excluded.rate_bps,
          amount_cents = excluded.amount_cents,
          cap_applied = excluded.cap_applied,
          plan_key = excluded.plan_key
      where public.commissions.status in ('pending', 'payable');
  else
    -- No charge stands for a job that was not completed, or is no longer
    -- verified. A commission already paid is left alone: money moved.
    delete from public.commissions
     where job_report_id = new.id
       and status in ('pending', 'payable');
  end if;
  return new;
end;
$$;

revoke all on function public.sync_job_commission() from public;

drop trigger if exists sync_job_commission on public.job_reports;
create trigger sync_job_commission
  after insert or update on public.job_reports
  for each row execute function public.sync_job_commission();

-- ---------------------------------------------------------------------------
-- Disputes: a contractor contesting a charge.
-- ---------------------------------------------------------------------------
create table if not exists public.commission_disputes (
  id uuid primary key default gen_random_uuid(),
  commission_id uuid not null references public.commissions(id) on delete cascade,
  provider_id uuid not null references public.providers(id) on delete cascade,
  reason text not null,
  status text not null default 'open' check (status in ('open', 'resolved', 'rejected')),
  resolution_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid
);

create index if not exists commission_disputes_status_idx
  on public.commission_disputes (status, created_at desc);

alter table public.commission_disputes enable row level security;

drop policy if exists commission_disputes_own_read on public.commission_disputes;
create policy commission_disputes_own_read on public.commission_disputes
  for select to authenticated
  using (provider_id in (select id from public.providers where auth_user_id = (select auth.uid())));

drop policy if exists commission_disputes_own_insert on public.commission_disputes;
create policy commission_disputes_own_insert on public.commission_disputes
  for insert to authenticated
  with check (
    provider_id in (select id from public.providers where auth_user_id = (select auth.uid()))
    and status = 'open'
  );

drop policy if exists commission_disputes_admin on public.commission_disputes;
create policy commission_disputes_admin on public.commission_disputes
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

grant select, insert on public.commission_disputes to authenticated;
grant update on public.commission_disputes to authenticated;

-- ---------------------------------------------------------------------------
-- Fraud review: management's record of looking into something suspicious.
-- ---------------------------------------------------------------------------
create table if not exists public.fraud_reviews (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('provider', 'job_report', 'commission')),
  subject_id uuid not null,
  reason text not null,
  status text not null default 'open' check (status in ('open', 'cleared', 'confirmed')),
  note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  unique (subject_type, subject_id)
);

alter table public.fraud_reviews enable row level security;

drop policy if exists fraud_reviews_admin on public.fraud_reviews;
create policy fraud_reviews_admin on public.fraud_reviews
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

grant select, insert, update on public.fraud_reviews to authenticated;

-- ---------------------------------------------------------------------------
-- Every change to these tables is recorded, as with the rest of the dashboard.
-- ---------------------------------------------------------------------------
do $$
declare
  target text;
begin
  foreach target in array array[
    'commission_settings', 'lead_ledger', 'job_reports', 'commissions',
    'commission_disputes', 'fraud_reviews'
  ]
  loop
    execute format('drop trigger if exists log_activity on public.%I', target);
    execute format(
      'create trigger log_activity after insert or update or delete on public.%I
         for each row execute function public.log_activity()',
      target
    );
  end loop;
end;
$$;

-- NOTE ON COLLECTING THE COMMISSION
--
-- This schema records what is owed and lets management settle it with a
-- reference to a real payment. It deliberately does not attempt to charge a
-- card, because the platform's payment runtime exposes fixed-price Stripe
-- Checkout, the customer portal and subscription state - there is no
-- variable-amount charge, invoice or payment-intent endpoint. Charging 10% of
-- an arbitrary job total therefore needs one of:
--
--   * a platform payment API that accepts an amount (payment intent / invoice), or
--   * this project's own Stripe account with its secret key held server-side.
--
-- Until one exists, a commission stays 'pending'/'payable' and is never shown
-- to a contractor as collected.
