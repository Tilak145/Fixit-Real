-- The guard in 0031 was too broad: it also refused the platform's own
-- privileged path, which has no end-user identity and already sits above Row
-- Level Security. A maintenance or backfill write must still be possible. The
-- browser cannot reach this branch, because only signed-in roles are granted
-- access to the quotes table at all, so a missing auth.uid() means a
-- server-side write, not a customer slipping through.

create or replace function public.quotes_protect_terms()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_caller_is_owner boolean;
  v_caller_is_admin boolean;
begin
  -- A server-side write with no end-user identity is not the customer or the
  -- professional, and is already outside the rules this trigger protects.
  if v_uid is null then
    return new;
  end if;

  v_caller_is_owner := exists (
    select 1 from public.providers p
    where p.id = old.provider_id
      and p.auth_user_id = v_uid
  );
  v_caller_is_admin := (select public.is_admin());

  if new.quote_request_id is distinct from old.quote_request_id
     or new.provider_id is distinct from old.provider_id then
    raise exception 'A quote cannot be moved to another request or professional.'
      using errcode = 'check_violation';
  end if;

  if v_caller_is_owner then
    if old.status = 'accepted' then
      raise exception 'This quote was accepted and can no longer be changed.'
        using errcode = 'check_violation';
    end if;
    return new;
  end if;

  if v_caller_is_admin then
    return new;
  end if;

  if new.amount_cents is distinct from old.amount_cents
     or new.note is distinct from old.note then
    raise exception 'The price on a quote cannot be changed when answering it.'
      using errcode = 'check_violation';
  end if;
  if old.status <> 'sent' or new.status not in ('accepted', 'declined') then
    raise exception 'A quote can only be answered once, with accepted or declined.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
