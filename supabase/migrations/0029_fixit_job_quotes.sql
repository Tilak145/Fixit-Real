-- Contact details change hands only once a price is agreed.
--
-- Until now a professional saw the customer's phone, email and address the
-- moment they accepted a lead (0018, 0020). Claiming a lead says "I am
-- interested"; it does not say "we agreed on a price", so the details were
-- released a step too early. This adds the missing step: the professional
-- sends a price, the customer accepts it, and only then are the contact
-- details readable. The gate lives in Row Level Security, not in the screen,
-- so no client can read around it.
--
-- One quote per lead per professional. The professional may revise a quote
-- while it is still unanswered or after a decline; the customer may accept or
-- decline an unanswered quote; once accepted the quote is frozen.

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  quote_request_id uuid not null references public.quote_requests(id) on delete cascade,
  provider_id uuid not null references public.providers(id) on delete cascade,
  amount_cents bigint not null check (amount_cents > 0),
  note text,
  status text not null default 'sent' check (status in ('sent', 'accepted', 'declined', 'withdrawn')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  -- The same professional cannot send two competing quotes for one lead; they
  -- revise the one they sent instead.
  unique (quote_request_id, provider_id)
);

create index if not exists quotes_request_idx on public.quotes (quote_request_id, created_at desc);
create index if not exists quotes_provider_idx on public.quotes (provider_id, created_at desc);

-- The moment a customer answers is recorded by the database, not by whatever
-- the client happens to send.
create or replace function public.quotes_stamp_response()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('accepted', 'declined') and new.status is distinct from old.status then
    new.responded_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists quotes_stamp_response on public.quotes;
create trigger quotes_stamp_response
  before update on public.quotes
  for each row execute function public.quotes_stamp_response();

alter table public.quotes enable row level security;

-- A professional reads their own quotes.
drop policy if exists quotes_provider_select on public.quotes;
create policy quotes_provider_select on public.quotes
  for select to authenticated
  using (provider_id in (select id from public.providers where auth_user_id = (select auth.uid())));

-- ...sends one only for a lead they have claimed...
drop policy if exists quotes_provider_insert on public.quotes;
create policy quotes_provider_insert on public.quotes
  for insert to authenticated
  with check (
    provider_id in (select id from public.providers where auth_user_id = (select auth.uid()))
    and exists (
      select 1 from public.quote_requests q
      join public.providers p on p.id = q.claimed_by
      where q.id = quote_request_id
        and p.auth_user_id = (select auth.uid())
    )
  );

-- ...and revises it while it is unanswered, or after the customer declines.
-- An accepted quote is final.
drop policy if exists quotes_provider_update on public.quotes;
create policy quotes_provider_update on public.quotes
  for update to authenticated
  using (
    status in ('sent', 'declined')
    and provider_id in (select id from public.providers where auth_user_id = (select auth.uid()))
  )
  with check (
    status in ('sent', 'withdrawn')
    and provider_id in (select id from public.providers where auth_user_id = (select auth.uid()))
  );

-- The customer reads the quote on their own request.
drop policy if exists quotes_customer_select on public.quotes;
create policy quotes_customer_select on public.quotes
  for select to authenticated
  using (
    exists (
      select 1 from public.quote_requests q
      where q.id = quote_request_id
        and q.customer_user_id = (select auth.uid())
    )
  );

-- The customer answers an unanswered quote, and may only set it to accepted or
-- declined; they cannot rewrite the price.
drop policy if exists quotes_customer_respond on public.quotes;
create policy quotes_customer_respond on public.quotes
  for update to authenticated
  using (
    status = 'sent'
    and exists (
      select 1 from public.quote_requests q
      where q.id = quote_request_id
        and q.customer_user_id = (select auth.uid())
    )
  )
  with check (
    status in ('accepted', 'declined')
    and exists (
      select 1 from public.quote_requests q
      where q.id = quote_request_id
        and q.customer_user_id = (select auth.uid())
    )
  );

-- Management keeps its oversight, including of a quote that is disputed.
drop policy if exists quotes_admin on public.quotes;
create policy quotes_admin on public.quotes
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

grant select, insert, update, delete on public.quotes to authenticated;

-- ---------------------------------------------------------------------------
-- The contact-details gate moves from "accepted the lead" to "quote accepted".
-- ---------------------------------------------------------------------------
drop policy if exists quote_request_contacts_claiming_provider on public.quote_request_contacts;
drop policy if exists quote_request_contacts_accepted_quote on public.quote_request_contacts;
create policy quote_request_contacts_accepted_quote on public.quote_request_contacts
  for select to authenticated
  using (
    exists (
      select 1
      from public.quotes qt
      join public.providers p on p.id = qt.provider_id
      where qt.quote_request_id = quote_request_id
        and qt.status = 'accepted'
        and p.auth_user_id = (select auth.uid())
    )
  );
