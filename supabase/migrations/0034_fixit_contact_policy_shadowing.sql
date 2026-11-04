-- Fix a shadowing bug in the contact-release policy from 0030.
--
-- The accepted-quote branch of the policy read
--
--     from public.quotes qt where qt.quote_request_id = quote_request_id
--
-- and the bare "quote_request_id" on the right resolved to qt.quote_request_id,
-- the subquery's own column, not to the request being policed. The condition was
-- therefore true for every row as soon as any quote anywhere had been accepted,
-- which released every contact row to any professional holding an accepted
-- quote. Qualifying the outer column by its table name is what actually links
-- the two.
--
-- The policy is restated in full, and the corrected branch now means: this
-- professional has an accepted quote on this very request.

drop policy if exists quote_request_contacts_unlocked on public.quote_request_contacts;
create policy quote_request_contacts_unlocked on public.quote_request_contacts
  for select to authenticated
  using (
    exists (
      select 1
      from public.quote_requests q
      join public.providers p on p.id = q.claimed_by
      where q.id = public.quote_request_contacts.quote_request_id
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
      where qt.quote_request_id = public.quote_request_contacts.quote_request_id
        and qt.status = 'accepted'
        and p.auth_user_id = (select auth.uid())
    )
  );
