-- Remembers, per person and per conversation, when they last read it, so the
-- site can say "you have a new message". Each person sees only their own rows.
create table if not exists public.message_reads (
  user_id uuid not null references auth.users(id) on delete cascade,
  quote_request_id uuid not null references public.quote_requests(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (user_id, quote_request_id)
);

alter table public.message_reads enable row level security;

create policy "people read their own message marks" on public.message_reads
  for select to authenticated using (user_id = (select auth.uid()));
create policy "people write their own message marks" on public.message_reads
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "people update their own message marks" on public.message_reads
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Unread messages for the signed-in person: one row per conversation that has
-- messages from the other side newer than their last read. Runs as the caller,
-- so Row Level Security on messages still decides which conversations count.
create or replace function public.my_unread_messages()
returns table (
  quote_request_id uuid,
  unread_count bigint,
  last_body text,
  last_sender_role text,
  last_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    m.quote_request_id,
    count(*) as unread_count,
    (array_agg(m.body order by m.created_at desc))[1] as last_body,
    (array_agg(m.sender_role order by m.created_at desc))[1] as last_sender_role,
    max(m.created_at) as last_at
  from public.messages m
  left join public.message_reads r
    on r.quote_request_id = m.quote_request_id
   and r.user_id = (select auth.uid())
  where m.sender_user_id <> (select auth.uid())
    and m.created_at > coalesce(r.last_read_at, '-infinity'::timestamptz)
  group by m.quote_request_id
  order by max(m.created_at) desc;
$$;

grant execute on function public.my_unread_messages() to authenticated;
