-- A price is only worth sending while the customer is still choosing.
--
-- 0038 opened quoting to every matching professional. Without a stop condition
-- that also lets a professional quote a job that was completed last month, or
-- one the customer has already awarded, which wastes their time and clutters a
-- closed request with a price nobody will read. The rule is simple and belongs
-- in the database with the rest of the quoting rules: a quote may be sent while
-- the request is open and has no accepted price yet. Revising an existing quote
-- is unaffected, so a professional who is already in the running keeps their
-- place — including after someone else's price was declined.

drop policy if exists quotes_provider_insert on public.quotes;
create policy quotes_provider_insert on public.quotes
  for insert to authenticated
  with check (
    provider_id in (select id from public.providers where auth_user_id = (select auth.uid()))
    and exists (
      select 1
      from public.quote_requests q
      join public.providers p on p.auth_user_id = (select auth.uid())
      join public.provider_services s on s.provider_id = p.id and s.category_slug = q.category_slug
      join public.provider_service_areas a on a.provider_id = p.id and a.city = q.city
      where q.id = quote_request_id
        and (p.accepting_work or q.claimed_by = p.id)
        and q.status <> 'completed'
        and not exists (
          select 1 from public.quotes existing
          where existing.quote_request_id = q.id
            and existing.status = 'accepted'
        )
    )
  );
