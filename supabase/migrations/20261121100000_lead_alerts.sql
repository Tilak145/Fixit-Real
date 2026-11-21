-- Tells a professional when a new lead reaches them, by email and by phone.
--
-- A lead is only visible to a pro once the rules in the "providers see matching
-- leads" policy are met: approved, not paused, offers the trade, serves the
-- city, accepting work, takes emergencies if it is one, and (for non-emergency
-- work) the plan's first-pick delay has passed. queue_lead_alerts() applies the
-- same rules, so a pro is told at the moment they could first see the lead, and
-- never about one they cannot open.
--
-- The notify-leads edge function is called every minute. It queues what is due,
-- sends the email and the phone notification, and marks each alert.

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- One row per (lead, professional): the primary key is what stops a second alert.
create table if not exists public.lead_alerts (
  request_id uuid not null references public.quote_requests (id) on delete cascade,
  provider_id uuid not null references public.providers (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  emailed boolean not null default false,
  pushed boolean not null default false,
  detail text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  primary key (request_id, provider_id)
);

create index if not exists lead_alerts_pending_idx on public.lead_alerts (created_at) where status = 'pending';

alter table public.lead_alerts enable row level security;
revoke all on table public.lead_alerts from anon, authenticated;
-- No policies: only the server-side sender reads or writes this table.

-- Phone notification addresses, one per installed app. A person manages only their own.
create table if not exists public.push_tokens (
  token text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null default 'android',
  updated_at timestamptz not null default now()
);

create index if not exists push_tokens_user_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;
revoke all on table public.push_tokens from anon;
grant select, insert, update, delete on table public.push_tokens to authenticated;

drop policy if exists "push tokens: own rows" on public.push_tokens;
create policy "push tokens: own rows" on public.push_tokens
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Queues an alert for every (lead, pro) pair that is visible right now and not
-- yet alerted. Only leads from the last 3 hours are considered, so switching this
-- on never mails old requests. Returns how many were queued.
create or replace function public.queue_lead_alerts()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  queued integer;
begin
  with due as (
    select r.id as request_id, p.id as provider_id
    from public.quote_requests r
    join public.provider_service_areas a on a.city = r.city
    join public.providers p on p.id = a.provider_id
    cross join lateral public.plan_entitlements(p.plan) e (max_cities, max_categories, placement, first_pick_minutes)
    where r.status = 'new'
      and r.claimed_by is null
      and r.created_at > now() - interval '3 hours'
      and p.status = 'approved'
      and p.accepting_work
      and not public.provider_leads_paused(p.plan, p.trial_ends_at)
      and public.provider_offers_trade(p.id, r.category_slug)
      and (r.is_emergency = false or p.accepts_emergency)
      and (r.is_emergency or r.created_at <= now() - make_interval(mins => e.first_pick_minutes))
      and not public.quote_request_is_withheld(r.id)
  ), added as (
    insert into public.lead_alerts (request_id, provider_id)
    select request_id, provider_id from due
    on conflict do nothing
    returning 1
  )
  select count(*) into queued from added;
  return queued;
end;
$$;

revoke all on function public.queue_lead_alerts() from public, anon, authenticated;
grant execute on function public.queue_lead_alerts() to service_role;

-- Once a minute, wake the sender. It needs no secret: it only ever works through
-- the queue above, and an extra call finds nothing new to send.
do $$
begin
  perform cron.unschedule('notify-leads');
exception when others then
  null;
end $$;

select cron.schedule(
  'notify-leads',
  '* * * * *',
  $cron$
    select net.http_post(
      url := 'https://kghmrjphvvgfcbllbsxe.supabase.co/functions/v1/notify-leads',
      headers := jsonb_build_object('content-type', 'application/json'),
      body := '{}'::jsonb,
      timeout_milliseconds := 20000
    );
  $cron$
);
