-- Customers can see the quote requests they submitted from the app or website.
-- Requests stay viewable by the professionals they were routed to (0001).
alter table public.quote_requests
  add column if not exists customer_user_id uuid references auth.users(id) on delete set null;

create index if not exists quote_requests_customer_user_id_idx
  on public.quote_requests (customer_user_id, created_at desc);

drop policy if exists "customers see their own requests" on public.quote_requests;
create policy "customers see their own requests" on public.quote_requests for select using (
  customer_user_id is not null and customer_user_id = auth.uid()
);
