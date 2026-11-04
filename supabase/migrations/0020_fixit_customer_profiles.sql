-- A customer who signs up gives their name, phone and address once, and every
-- quote request they send after that carries it. The address is private the
-- same way the phone and email are (0018): a professional sees it only after
-- accepting the lead.

create table if not exists public.customer_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  address text,
  city text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.customer_profiles enable row level security;

drop policy if exists customer_profiles_own on public.customer_profiles;
create policy customer_profiles_own on public.customer_profiles
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists customer_profiles_admin on public.customer_profiles;
create policy customer_profiles_admin on public.customer_profiles
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

grant select, insert, update, delete on public.customer_profiles to authenticated;

-- Where the work is. It travels with the request, and is granted to a reader on
-- the same terms as the phone and email below: table-level select is withheld
-- (0019), so these columns are unreadable except through quote_request_contacts.
alter table public.quote_requests
  add column if not exists customer_address text;

alter table public.quote_request_contacts
  add column if not exists customer_address text;

-- Carry the address across to the private table, exactly as 0018 does for the
-- contact details.
create or replace function public.quote_requests_sync_contacts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.quote_request_contacts
    (quote_request_id, customer_email, customer_phone, customer_address, updated_at)
  values (new.id, new.customer_email, new.customer_phone, new.customer_address, now())
  on conflict (quote_request_id) do update
    set customer_email = excluded.customer_email,
        customer_phone = excluded.customer_phone,
        customer_address = excluded.customer_address,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists quote_requests_sync_contacts on public.quote_requests;
create trigger quote_requests_sync_contacts
  after insert or update of customer_email, customer_phone, customer_address on public.quote_requests
  for each row execute function public.quote_requests_sync_contacts();

-- Backfill the address already on file for existing leads.
update public.quote_request_contacts c
set customer_address = q.customer_address
from public.quote_requests q
where q.id = c.quote_request_id
  and q.customer_address is not null;
