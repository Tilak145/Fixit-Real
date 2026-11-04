-- The reminder keeps its own copy of the message, so a retry tomorrow sends the
-- same words, and a free period that falls due before the reminder is recorded
-- still gets one (remind_on is never later than today, so the next sweep picks
-- it up straight away).

alter table public.pro_trial_reminders
  add column if not exists message text;

-- Nothing can be sent before the provider is connected anyway; drop the old,
-- unsent rows so they are recreated with their message instead of staying blank.
delete from public.pro_trial_reminders where status = 'pending' and message is null;

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
      p.business_name,
      p.email,
      coalesce(p.plan, 'professional') as plan,
      case coalesce(p.plan, 'professional')
        when 'starter' then 99
        when 'business' then 399
        else 199
      end as price_per_month
    from public.providers p
    where p.plan = 'founding'
      and p.trial_ends_at is not null
      and p.trial_ends_at > now()
      -- Everyone due: inside the last 14 days, or already inside them when they
      -- joined late.
      and p.trial_ends_at <= now() + interval '14 days'
  ), inserted as (
    insert into public.pro_trial_reminders
      (provider_id, trial_ends_at, plan, price_per_month, remind_on, email_to, message)
    select
      due.provider_id,
      due.trial_ends_at,
      due.plan,
      due.price_per_month,
      least((due.trial_ends_at at time zone 'America/New_York')::date - 14, (now() at time zone 'America/New_York')::date),
      due.email,
      public.trial_reminder_message(due.business_name, due.trial_ends_at, due.plan, due.price_per_month)
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
