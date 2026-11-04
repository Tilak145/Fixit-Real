-- A request belongs to a customer account.
--
-- Until now a visitor could send a request without signing up. Nobody could
-- then accept a price on their behalf: the pro kept their contact details
-- without the customer ever agreeing, and the customer had no place to see
-- who they chose. Requests are now tied to the account that sent them, so the
-- accept step, the photos and the privacy of phone and address all work.

drop policy if exists "anyone can submit a quote request" on public.quote_requests;

drop policy if exists "customers submit their own requests" on public.quote_requests;
create policy "customers submit their own requests" on public.quote_requests
  for insert to authenticated
  with check (
    customer_user_id = (select auth.uid())
    and length(btrim(customer_email)) > 0
  );

-- The platform's own writes (imports, repairs run with no signed-in user) are
-- not a customer posting a job, and are left alone.
create or replace function public.quote_requests_need_customer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.customer_user_id is null and (select auth.uid()) is not null then
    raise exception 'Please sign in or create an account so your request has an owner.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists quote_requests_need_customer on public.quote_requests;
create trigger quote_requests_need_customer
  before insert on public.quote_requests
  for each row execute function public.quote_requests_need_customer();
