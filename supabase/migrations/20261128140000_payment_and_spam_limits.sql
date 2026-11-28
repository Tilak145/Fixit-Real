-- 1. A paid plan must be paid for. Until now a business could choose a paid plan
--    and receive its leads and placement without paying. Staff and the billing
--    system are not affected, and neither is the free Founding Pro plan.
--      * Signing up on a paid plan: the plan is remembered, but no new leads
--        arrive until a subscription is active (the existing billing trigger
--        then switches them on).
--      * Switching to a paid plan: the plan stays as it is until billing
--        changes it after payment.
-- 2. Limits on forms that can be flooded.

create or replace function public.providers_require_payment()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null or (select public.is_admin()) or new.plan = 'founding' then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if new.plan is distinct from old.plan then
      new.plan := old.plan;
      new.founding_locked_until := old.founding_locked_until;
      new.trial_ends_at := old.trial_ends_at;
    end if;
    return new;
  end if;
  if not exists (
    select 1 from public.payment_subscriptions s
    where s.user_id = new.auth_user_id and s.livemode and s.status in ('active', 'trialing', 'past_due')
  ) then
    new.billing_lapsed_at := now();
  end if;
  return new;
end;
$$;
revoke all on function public.providers_require_payment() from public, anon, authenticated;
drop trigger if exists zz_providers_require_payment on public.providers;
-- Named to run after the triggers that reset these columns.
create trigger zz_providers_require_payment before insert or update on public.providers
  for each row execute function public.providers_require_payment();

-- ---- Spam limits -----------------------------------------------------------

create or replace function public.limit_waitlist()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if (select public.is_admin()) then return new; end if;
  if (select count(*) from public.service_waitlist w
      where lower(w.email) = lower(new.email) and w.created_at > now() - interval '1 day') >= 5
     or (select count(*) from public.service_waitlist w where w.created_at > now() - interval '1 hour') >= 60 then
    raise exception 'That is a lot of sign-ups in a short time. Please try again later.';
  end if;
  return new;
end;
$$;
revoke all on function public.limit_waitlist() from public, anon, authenticated;
drop trigger if exists service_waitlist_limit on public.service_waitlist;
create trigger service_waitlist_limit before insert on public.service_waitlist
  for each row execute function public.limit_waitlist();

-- Signed-in accounts. Visitors without an account are limited by submit_guest_request.
create or replace function public.limit_account_requests()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null or (select public.is_admin()) then return new; end if;
  if (select count(*) from public.quote_requests q
      where q.customer_user_id = (select auth.uid()) and q.created_at > now() - interval '1 hour')
     >= (case when new.organization_id is null then 15 else 60 end) then
    raise exception 'You have sent many requests this hour. Please try again a little later.';
  end if;
  return new;
end;
$$;
revoke all on function public.limit_account_requests() from public, anon, authenticated;
drop trigger if exists quote_requests_b_limit on public.quote_requests;
create trigger quote_requests_b_limit before insert on public.quote_requests
  for each row execute function public.limit_account_requests();

create or replace function public.limit_messages()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null or (select public.is_admin()) then return new; end if;
  if (select count(*) from public.messages m
      where m.quote_request_id = new.quote_request_id and m.sender_role = new.sender_role
        and m.created_at > now() - interval '1 minute') >= 20 then
    raise exception 'You are sending messages very quickly. Wait a minute and try again.';
  end if;
  return new;
end;
$$;
revoke all on function public.limit_messages() from public, anon, authenticated;
drop trigger if exists messages_limit on public.messages;
create trigger messages_limit before insert on public.messages
  for each row execute function public.limit_messages();
