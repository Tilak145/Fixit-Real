-- A professional can step out of the rotation the moment they get busy.
--
-- Weekly hours answer "when do you normally work". They cannot answer "I am
-- slammed today" or "I am standing in a crawlspace until four". Without a switch
-- the only way to stop the phone ringing was to change the week or let leads
-- pile up, and a pro who lets leads pile up stops trusting the product. This
-- adds one boolean they can flip in a second.
--
--   * accepting_work is on for a new professional, so nothing changes for
--     anyone who never touches it;
--   * a lead already claimed stays visible to the pro who holds it, whatever
--     they set afterwards, so switching off never hides an active job;
--   * emergency leads keep their own rule (0027): only a pro who opted in to
--     after-hours work is offered one, and now also only while they are on.

alter table public.providers
  add column if not exists accepting_work boolean not null default true;

grant select (accepting_work) on public.providers to anon, authenticated;

-- Restate the routing rule with the switch included: a matching lead reaches a
-- professional only while they are accepting work. A pro who already holds the
-- lead keeps seeing it either way.
drop policy if exists "providers see matching leads" on public.quote_requests;
create policy "providers see matching leads" on public.quote_requests for select using (
  exists (
    select 1 from public.providers p
    join public.provider_services s on s.provider_id = p.id
    join public.provider_service_areas a on a.provider_id = p.id
    where p.auth_user_id = (select auth.uid())
      and s.category_slug = quote_requests.category_slug
      and a.city = quote_requests.city
      and p.accepting_work
      and (quote_requests.is_emergency = false or p.accepts_emergency)
  ) or claimed_by in (select id from public.providers where auth_user_id = (select auth.uid()))
);
