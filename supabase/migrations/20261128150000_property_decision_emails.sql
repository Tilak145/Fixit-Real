-- When the owner approves or declines a property account, its owner is emailed.
-- The decision queues a row; the notify-property function sends it, woken at
-- once and retried by a once-a-minute schedule.

create table if not exists public.property_notices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  email_status text not null default 'pending' check (email_status in ('pending', 'sending', 'sent', 'failed')),
  email_attempts integer not null default 0,
  email_claimed_at timestamptz,
  email_detail text
);
create index if not exists property_notices_pending_idx on public.property_notices (created_at)
  where email_status in ('pending', 'sending');

-- Only the server touches this queue.
alter table public.property_notices enable row level security;
revoke all on public.property_notices from anon, authenticated;
grant select, update on public.property_notices to service_role;

create or replace function public.queue_property_decision()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.status is distinct from old.status and new.status in ('approved', 'rejected') then
    insert into public.property_notices (organization_id, title, body)
    values (
      new.id,
      case when new.status = 'approved' then 'Your FixIt property account is approved'
           else 'Your FixIt property account cannot send jobs' end,
      case when new.status = 'approved' then 'You can now send repair requests to local professionals.'
           else 'FixIt has not approved sending jobs from this account. Reply to this email or contact FixIt support if you have questions.' end
    );
  end if;
  return new;
end;
$$;
revoke all on function public.queue_property_decision() from public, anon, authenticated;
drop trigger if exists organizations_queue_decision on public.organizations;
create trigger organizations_queue_decision after update of status on public.organizations
  for each row execute function public.queue_property_decision();

-- Hands each waiting notice to exactly one sender, with the address to use.
create or replace function public.claim_property_emails(p_limit integer default 25)
returns table (id uuid, title text, body text, email text, account_name text, email_attempts integer)
language sql security definer set search_path = ''
as $$
  with claimed as (
    update public.property_notices n
    set email_status = 'sending', email_claimed_at = now(), email_attempts = n.email_attempts + 1
    where n.id in (
      select c.id from public.property_notices c
      where c.email_status = 'pending'
         or (c.email_status = 'sending' and c.email_claimed_at < now() - interval '5 minutes')
      order by c.created_at
      limit p_limit
      for update skip locked
    )
    returning n.id, n.organization_id, n.title, n.body, n.email_attempts
  )
  select c.id, c.title, c.body,
    (select u.email::text from public.organization_members m join auth.users u on u.id = m.user_id
      where m.organization_id = c.organization_id and m.role = 'owner' limit 1),
    o.name, c.email_attempts
  from claimed c join public.organizations o on o.id = c.organization_id;
$$;
revoke all on function public.claim_property_emails(integer) from public, anon, authenticated;
grant execute on function public.claim_property_emails(integer) to service_role;

create or replace function public.wake_property_sender()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  perform net.http_post(
    url := 'https://kghmrjphvvgfcbllbsxe.supabase.co/functions/v1/notify-property',
    headers := jsonb_build_object('content-type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
  return null;
exception when others then
  -- Email must never block the decision being saved; the schedule retries.
  return null;
end;
$$;
revoke all on function public.wake_property_sender() from public, anon, authenticated;
drop trigger if exists property_notices_wake_sender on public.property_notices;
create trigger property_notices_wake_sender after insert on public.property_notices
  for each statement execute function public.wake_property_sender();

do $$ begin
  perform cron.unschedule('notify-property');
exception when others then null;
end $$;
select cron.schedule('notify-property', '* * * * *', $cron$
  select net.http_post(
    url := 'https://kghmrjphvvgfcbllbsxe.supabase.co/functions/v1/notify-property',
    headers := jsonb_build_object('content-type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  )
  where exists (select 1 from public.property_notices where email_status in ('pending', 'sending'));
$cron$);
