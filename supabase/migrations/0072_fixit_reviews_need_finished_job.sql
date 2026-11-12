-- A review has to come from a customer whose job with that professional finished.
--
-- Until now any signed-in account could review any professional, so a rating
-- could be written by someone who never hired them. The rule is held here, not
-- only in the form, so it applies to the website and the phone app alike.
--
-- A customer keeps one review per professional (reviews_author_provider_idx) and
-- may edit it. The same check on update stops a review being moved to another
-- professional they never hired.

drop policy if exists "customers can leave a review" on public.reviews;
create policy "customers can leave a review" on public.reviews
  for insert to authenticated
  with check (
    author_user_id = (select auth.uid())
    and exists (
      select 1 from public.quote_requests q
      where q.customer_user_id = (select auth.uid())
        and q.claimed_by = reviews.provider_id
        and q.status = 'completed'
    )
  );

drop policy if exists "customers update their review" on public.reviews;
create policy "customers update their review" on public.reviews
  for update to authenticated
  using (author_user_id = (select auth.uid()))
  with check (
    author_user_id = (select auth.uid())
    and exists (
      select 1 from public.quote_requests q
      where q.customer_user_id = (select auth.uid())
        and q.claimed_by = reviews.provider_id
        and q.status = 'completed'
    )
  );
