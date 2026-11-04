-- Two honest gaps in the quote gate from 0029.
--
-- 1. A guest may submit a request without an account, and a guest has nobody to
--    accept a quote. Their contact details would then be locked away forever,
--    which helps no one. For a request with no customer account, the pro who
--    holds the lead keeps seeing the contacts, exactly as before.
--
-- 2. A job already at the appointment stage is further along than a claim. The
--    pro and customer have agreed to meet, so the pro keeps the contact details
--    they are already using, rather than losing them when this rule changed.
--
-- Everything else still waits for an accepted quote.

drop policy if exists quote_request_contacts_accepted_quote on public.quote_request_contacts;
drop policy if exists quote_request_contacts_unlocked on public.quote_request_contacts;
create policy quote_request_contacts_unlocked on public.quote_request_contacts
  for select to authenticated
  using (
    exists (
      select 1
      from public.quote_requests q
      join public.providers p on p.id = q.claimed_by
      where q.id = quote_request_id
        and p.auth_user_id = (select auth.uid())
        and (
          -- A live appointment means the two sides already agreed to meet.
          exists (
            select 1 from public.appointments a
            where a.quote_request_id = q.id
              and a.provider_id = p.id
              and a.status <> 'cancelled'
          )
          -- A guest request has no customer account to accept a price.
          or q.customer_user_id is null
        )
    )
    or exists (
      select 1
      from public.quotes qt
      join public.providers p on p.id = qt.provider_id
      where qt.quote_request_id = quote_request_id
        and qt.status = 'accepted'
        and p.auth_user_id = (select auth.uid())
    )
  );
