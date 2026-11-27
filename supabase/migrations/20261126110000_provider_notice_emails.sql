-- Every notice to a professional is also emailed. The notify-notices function is
-- woken the moment a notice is saved, and a once-a-minute schedule retries
-- anything that did not go the first time.

alter table public.provider_notices
  add column if not exists email_status text not null default 'pending' check (email_status in ('pending','sending','sent','failed')),
  add column if not exists email_attempts integer not null default 0,
  add column if not exists email_claimed_at timestamptz,
  add column if not exists email_detail text;

create index if not exists provider_notices_email_pending_idx on public.provider_notices (created_at) where email_status in ('pending','sending');

-- Hands each waiting notice to exactly one sender, so two calls at once never email twice.
create or replace function public.claim_notice_emails(p_limit integer default 25)
returns table (id uuid, provider_id uuid, title text, body text, tone text, email_attempts integer)
language sql security definer set search_path = ''
as $$
  update public.provider_notices n
  set email_status = 'sending', email_claimed_at = now(), email_attempts = n.email_attempts + 1
  where n.id in (
    select c.id from public.provider_notices c
    where c.email_status = 'pending'
       or (c.email_status = 'sending' and c.email_claimed_at < now() - interval '5 minutes')
    order by c.created_at
    limit p_limit
    for update skip locked
  )
  returning n.id, n.provider_id, n.title, n.body, n.tone, n.email_attempts;
$$;
revoke all on function public.claim_notice_emails(integer) from public, anon, authenticated;
grant execute on function public.claim_notice_emails(integer) to service_role;

-- Wake the sender the moment a notice is saved (sent after the change commits).
create or replace function public.wake_notice_sender()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  perform net.http_post(
    url := 'https://kghmrjphvvgfcbllbsxe.supabase.co/functions/v1/notify-notices',
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
revoke all on function public.wake_notice_sender() from public, anon, authenticated;
drop trigger if exists provider_notices_wake_sender on public.provider_notices;
create trigger provider_notices_wake_sender after insert on public.provider_notices
  for each statement execute function public.wake_notice_sender();

do $$ begin
  perform cron.unschedule('notify-notices');
exception when others then null;
end $$;
select cron.schedule('notify-notices', '* * * * *', $cron$
  select net.http_post(
    url := 'https://kghmrjphvvgfcbllbsxe.supabase.co/functions/v1/notify-notices',
    headers := jsonb_build_object('content-type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  )
  where exists (select 1 from public.provider_notices where email_status in ('pending','sending'));
$cron$);
