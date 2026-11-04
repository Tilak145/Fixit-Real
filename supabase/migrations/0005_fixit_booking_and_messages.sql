-- Closing the lead loop: a professional books a visit for a lead they claimed,
-- and the customer and the professional can message each other about it.
--
-- Access stays with Row Level Security: appointments and messages are readable
-- only by the customer who asked for the work, the professional who claimed it,
-- and the management dashboard.

alter table public.appointments
  add column if not exists status text not null default 'scheduled'
    check (status in ('scheduled','completed','cancelled')),
  add column if not exists notes text;

create index if not exists appointments_provider_idx
  on public.appointments (provider_id, scheduled_for desc);

-- The customer follows the visit scheduled for their own request.
drop policy if exists "customers see their appointments" on public.appointments;
create policy "customers see their appointments" on public.appointments
  for select to authenticated
  using (
    exists (
      select 1 from public.quote_requests q
      where q.id = quote_request_id
        and q.customer_user_id = (select auth.uid())
    )
  );

-- Messages belong to one quote request. The customer writes as the customer and
-- the claiming professional writes as the provider, so neither can speak for
-- the other side of the conversation.
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  quote_request_id uuid not null references public.quote_requests(id) on delete cascade,
  sender_role text not null check (sender_role in ('customer','provider')),
  sender_user_id uuid references auth.users(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists messages_thread_idx
  on public.messages (quote_request_id, created_at);

alter table public.messages enable row level security;

drop policy if exists "customers use their message thread" on public.messages;
create policy "customers use their message thread" on public.messages
  for all to authenticated
  using (
    exists (
      select 1 from public.quote_requests q
      where q.id = quote_request_id
        and q.customer_user_id = (select auth.uid())
    )
  )
  with check (
    sender_role = 'customer'
    and sender_user_id = (select auth.uid())
    and exists (
      select 1 from public.quote_requests q
      where q.id = quote_request_id
        and q.customer_user_id = (select auth.uid())
    )
  );

drop policy if exists "providers use claimed message threads" on public.messages;
create policy "providers use claimed message threads" on public.messages
  for all to authenticated
  using (
    exists (
      select 1 from public.quote_requests q
      join public.providers p on p.id = q.claimed_by
      where q.id = quote_request_id
        and p.auth_user_id = (select auth.uid())
    )
  )
  with check (
    sender_role = 'provider'
    and sender_user_id = (select auth.uid())
    and exists (
      select 1 from public.quote_requests q
      join public.providers p on p.id = q.claimed_by
      where q.id = quote_request_id
        and p.auth_user_id = (select auth.uid())
    )
  );
