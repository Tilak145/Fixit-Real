-- The words of the reminder, built in the database so the dashboard, the pro's
-- own screen and any email sender share one version of them.

create or replace function public.trial_reminder_kind(p_end timestamptz, p_now timestamptz default now())
returns text
language sql
immutable
as $$
  select case
    when p_end is null then 'none'
    when p_end <= p_now then 'ended'
    when p_end <= p_now + interval '14 days' then 'ending-soon'
    else 'active'
  end
$$;

create or replace function public.trial_reminder_message(p_business text, p_end timestamptz, p_plan text, p_price int)
returns text
language plpgsql
stable
as $$
declare
  plan_label text := initcap(coalesce(p_plan, 'professional'));
  money text := '$' || p_price || ' a month';
  ends text := to_char(p_end at time zone 'America/New_York', 'FMMonth FMDD, YYYY');
  left_days int := greatest(0, ceil(extract(epoch from (p_end - now())) / 86400))::int;
begin
  if p_end is null then return ''; end if;
  if p_end <= now() then
    return 'Your free period ended on ' || ends || '. Start your plan to keep your listing and leads.';
  end if;
  if p_end <= now() + interval '14 days' then
    return 'Heads up, ' || coalesce(p_business, 'there') || ': your Founding Pro free period ends on ' || ends
      || ' (' || left_days || case when left_days = 1 then ' day' else ' days' end || ' left). '
      || 'Nothing is charged automatically. To continue after that date, ' || plan_label || ' is ' || money
      || ' — start it from your Plan page. If you do nothing, your listing stays as it is.';
  end if;
  return 'You are in your free period, until ' || ends || '. After that, ' || plan_label || ' is ' || money || '.';
end;
$$;

revoke all on function public.trial_reminder_kind(timestamptz, timestamptz) from public;
revoke all on function public.trial_reminder_message(text, timestamptz, text, int) from public;
grant execute on function public.trial_reminder_kind(timestamptz, timestamptz) to authenticated;
grant execute on function public.trial_reminder_message(text, timestamptz, text, int) to authenticated;

-- The manager's list, now with the exact message each pro would receive and the
-- email address it would go to. Nothing here sends anything.
drop function if exists public.trial_reminders();
create function public.trial_reminders()
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
  message text
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
      coalesce(r.plan, 'professional'),
      coalesce(r.price_per_month,
        case coalesce(r.plan, 'professional')
          when 'starter' then 99 when 'business' then 399 else 199 end),
      p.trial_ends_at,
      greatest(0, ceil(extract(epoch from (p.trial_ends_at - now())) / 86400))::int,
      r.id,
      coalesce(r.status, 'due'),
      public.trial_reminder_message(
        p.business_name, p.trial_ends_at,
        coalesce(r.plan, 'professional'),
        coalesce(r.price_per_month, 199))
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

-- A manager records a reminder as handled after contacting the pro by hand.
create or replace function public.mark_trial_reminder_sent(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.is_admin()) then
    raise exception 'Only dashboard staff may update trial reminders.';
  end if;
  update public.pro_trial_reminders
  set status = 'sent', sent_at = now()
  where id = p_id and status <> 'sent';
end;
$$;

revoke all on function public.mark_trial_reminder_sent(uuid) from public;
grant execute on function public.mark_trial_reminder_sent(uuid) to authenticated;
