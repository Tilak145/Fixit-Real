-- A customer's phone and email were readable by every professional who matched
-- the job, before anyone accepted it. Row Level Security decides which rows a
-- pro may read, and it cannot hide a single column — so the contact details move
-- into their own table, where a row-level policy can wait until the lead is
-- claimed. That is also the honest product rule: contact details unlock when a
-- professional takes the job.
--
-- The columns stay on quote_requests so existing inserts keep working; a trigger
-- copies them across. They are no longer selectable through the API.

create table if not exists public.quote_request_contacts (
  quote_request_id uuid primary key references public.quote_requests(id) on delete cascade,
  customer_email text not null,
  customer_phone text,
  updated_at timestamptz not null default now()
);

-- Existing leads keep their contact details.
insert into public.quote_request_contacts (quote_request_id, customer_email, customer_phone)
select id, customer_email, customer_phone from public.quote_requests
on conflict (quote_request_id) do update
  set customer_email = excluded.customer_email,
      customer_phone = excluded.customer_phone,
      updated_at = now();

-- Every new lead, and any later correction, is mirrored here. Written as a
-- definer function so it works whatever the caller's own grants are.
create or replace function public.quote_requests_sync_contacts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.quote_request_contacts (quote_request_id, customer_email, customer_phone, updated_at)
  values (new.id, new.customer_email, new.customer_phone, now())
  on conflict (quote_request_id) do update
    set customer_email = excluded.customer_email,
        customer_phone = excluded.customer_phone,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists quote_requests_sync_contacts on public.quote_requests;
create trigger quote_requests_sync_contacts
  after insert or update of customer_email, customer_phone on public.quote_requests
  for each row execute function public.quote_requests_sync_contacts();

alter table public.quote_request_contacts enable row level security;

-- The customer sees the details on their own request.
drop policy if exists quote_request_contacts_customer on public.quote_request_contacts;
create policy quote_request_contacts_customer on public.quote_request_contacts
  for select to authenticated
  using (
    exists (
      select 1 from public.quote_requests q
      where q.id = quote_request_id
        and q.customer_user_id = (select auth.uid())
    )
  );

-- The professional who took the job sees them — and only after taking it.
drop policy if exists quote_request_contacts_claiming_provider on public.quote_request_contacts;
create policy quote_request_contacts_claiming_provider on public.quote_request_contacts
  for select to authenticated
  using (
    exists (
      select 1 from public.quote_requests q
      join public.providers p on p.id = q.claimed_by
      where q.id = quote_request_id
        and p.auth_user_id = (select auth.uid())
    )
  );

-- Management keeps its oversight of every lead.
drop policy if exists quote_request_contacts_admin on public.quote_request_contacts;
create policy quote_request_contacts_admin on public.quote_request_contacts
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

grant select on public.quote_request_contacts to authenticated;

-- Close the hole in the original table: no signed-in reader, matching pro or
-- not, may select the contact columns any more. Inserts and updates still work,
-- because those are table-level privileges.
revoke select (customer_email, customer_phone) on public.quote_requests from anon, authenticated;
