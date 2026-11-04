-- A reminder before a Founding Pro free period ends.
--
-- Stripe checkout in this project cannot start a trial, so nothing is charged
-- automatically on day 91: the professional starts their plan themselves. That
-- makes a reminder, rather than a charge, the thing that has to happen — and it
-- has to be a record, not a screen they might never open.
--
-- One reminder per free period: the unique key is the provider and the date the
-- period ends, so re-running the sweep, a plan change back and forth or a
-- reactivation cannot send the same reminder twice.

create table if not exists public.pro_trial_reminders (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete cascade,
  -- The free period this reminder is about.
  trial_ends_at timestamptz not null,
  -- The plan the pro will be on and its monthly price when the reminder was made.
  plan text not null,
  price_per_month int not null,
  remind_on date not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'dismissed')),
  sent_at timestamptz,
  email_to text,
  created_at timestamptz not null default now(),
  unique (provider_id, trial_ends_at)
);

alter table public.pro_trial_reminders enable row level security;

-- A professional sees only their own reminders.
drop policy if exists pro_trial_reminders_own on public.pro_trial_reminders;
create policy pro_trial_reminders_own on public.pro_trial_reminders
  for select to authenticated
  using (exists (
    select 1 from public.providers p
    where p.id = pro_trial_reminders.provider_id and p.auth_user_id = (select auth.uid())
  ));

-- Managers see every reminder.
drop policy if exists pro_trial_reminders_admin on public.pro_trial_reminders;
create policy pro_trial_reminders_admin on public.pro_trial_reminders
  for select to authenticated
  using (public.is_admin());

grant select on public.pro_trial_reminders to authenticated;

-- Record the reminders that are due, one per free period, and return how many
-- were new. Safe to run as often as you like. Not exposed to the browser: a
-- customer or pro could otherwise inflate the list.
create or replace function public.sweep_trial_reminders()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  made int;
begin
  with due as (
    select
      p.id as provider_id,
      p.trial_ends_at,
      p.plan,
      p.email,
      case coalesce(p.plan, 'professional')
        when 'starter' then 99
        when 'professional' then 199
        when 'business' then 399
        else 199
      end as price_per_month
    from public.providers p
    where p.plan = 'founding'
      and p.trial_ends_at is not null
      and p.trial_ends_at > now()
      and p.trial_ends_at <= now() + interval '14 days'
  ), inserted as (
    insert into public.pro_trial_reminders
      (provider_id, trial_ends_at, plan, price_per_month, remind_on, email_to)
    select
      due.provider_id,
      due.trial_ends_at,
      -- A founding place pays for the Professional plan unless the pro picks
      -- another before the date.
      'professional',
      due.price_per_month,
      (due.trial_ends_at at time zone 'America/New_York')::date - 14,
      due.email
    from due
    on conflict (provider_id, trial_ends_at) do nothing
    returning 1
  )
  select count(*)::int into made from inserted;
  return coalesce(made, 0);
end;
$$;

revoke all on function public.sweep_trial_reminders() from public;
revoke all on function public.sweep_trial_reminders() from anon, authenticated;

-- The manager list: what is due, when the free period ends, and whether the
-- reminder has gone. Reads live data, so a reminder arrives as soon as the date
-- is within 14 days even if the sweep has not run yet.
create or replace function public.trial_reminders()
returns table (
  provider_id uuid,
  business_name text,
  email text,
  plan text,
  price_per_month int,
  trial_ends_at timestamptz,
  days_left int,
  reminder_id uuid,
  reminder_status text,
  sent_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select public.is_admin()) then
    raise exception 'Only dashboard staff may see trial reminders.';
  end if;
  return query
    select
      p.id,
      p.business_name,
      p.email,
      r.plan,
      r.price_per_month,
      p.trial_ends_at,
      greatest(0, ceil(extract(epoch from (p.trial_ends_at - now())) / 86400))::int,
      r.id,
      coalesce(r.status, 'due'::text),
      r.sent_at
    from public.providers p
    left join public.pro_trial_reminders r
      on r.provider_id = p.id and r.trial_ends_at = p.trial_ends_at
    where p.plan = 'founding'
      and p.trial_ends_at is not null
      and p.trial_ends_at > now()
    order by p.trial_ends_at asc;
end;
$$;

revoke all on function public.trial_reminders() from public;
grant execute on function public.trial_reminders() to authenticated;

-- A professional marks their own reminder as seen on the dashboard.
create or replace function public.dismiss_my_trial_reminder(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.pro_trial_reminders r
  set status = 'dismissed'
  from public.providers p
  where r.id = p_id
    and p.id = r.provider_id
    and p.auth_user_id = (select auth.uid())
    and r.status <> 'sent';
end;
$$;

revoke all on function public.dismiss_my_trial_reminder(uuid) from public;
grant execute on function public.dismiss_my_trial_reminder(uuid) to authenticated;
