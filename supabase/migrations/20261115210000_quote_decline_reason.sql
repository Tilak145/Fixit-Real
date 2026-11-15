-- A declined price now says why.
--
-- A professional whose price was declined saw only "declined", and had to guess
-- whether it was the price, the timing or something else before sending a new
-- one. The customer now gives a reason when they decline, the database refuses
-- a decline without one, and the professional reads it beside their quote.

alter table public.quotes
  add column if not exists decline_reason text;

alter table public.quotes drop constraint if exists quotes_decline_reason_length;
alter table public.quotes
  add constraint quotes_decline_reason_length check (
    decline_reason is null or char_length(decline_reason) between 3 and 500
  );

-- The guard on answering a quote, with the reason added:
--   * a customer's decline must carry a reason; an acceptance carries none;
--   * the professional cannot write or edit the reason, and it is cleared when
--     they send a new price, because it was about the old one.
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
    -- The reason is the customer's words. A new price starts clean; anything
    -- else leaves it exactly as the customer wrote it.
    if new.status = 'sent' then
      new.decline_reason := null;
    else
      new.decline_reason := old.decline_reason;
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
  if new.status = 'declined' then
    new.decline_reason := nullif(btrim(coalesce(new.decline_reason, '')), '');
    if new.decline_reason is null then
      raise exception 'Please say why you are declining, so the professional knows.'
        using errcode = 'check_violation';
    end if;
  else
    new.decline_reason := null;
  end if;
  return new;
end;
$$;

-- Accepting one price closes the others. Those professionals are told why too,
-- in the platform's words, since the customer did not decline them one by one.
create or replace function public.quotes_award_on_accept()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Only a fresh acceptance awards the job; re-saving an accepted quote does not.
  if new.status <> 'accepted' or old.status = 'accepted' then
    return new;
  end if;

  -- Hand the request to the professional whose price was accepted.
  update public.quote_requests
  set claimed_by = new.provider_id,
      status = 'claimed'
  where id = new.quote_request_id;

  -- Close every other price on this job, so other professionals stop waiting on
  -- an answer that is not coming.
  update public.quotes
  set status = 'declined',
      responded_at = now(),
      decline_reason = 'The customer chose another professional''s price.'
  where quote_request_id = new.quote_request_id
    and id <> new.id
    and status = 'sent';

  return new;
end;
$$;
