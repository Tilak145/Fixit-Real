-- A quote's price is the pro's to set and the customer's only to answer. The
-- update policy alone could not express that: it checks which rows may change
-- and the resulting status, not which columns changed, so a customer could send
-- status = 'accepted' together with a rewritten amount_cents and "accept" a
-- price the professional never offered. This trigger is the missing half.
--
-- The rules, all enforced by the database rather than the screen:
--   * the request and the professional on a quote never change;
--   * only the professional who owns the quote may set or revise its price;
--   * a customer's answer may change the status and nothing else, and only from
--     'sent' to 'accepted' or 'declined';
--   * an answered quote is final, so neither side can quietly edit it.

create or replace function public.quotes_protect_terms()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_is_owner boolean;
  v_caller_is_admin boolean;
begin
  v_caller_is_owner := exists (
    select 1 from public.providers p
    where p.id = old.provider_id
      and p.auth_user_id = (select auth.uid())
  );
  v_caller_is_admin := (select public.is_admin());

  -- The parties to a quote are fixed for its whole life.
  if new.quote_request_id is distinct from old.quote_request_id
     or new.provider_id is distinct from old.provider_id then
    raise exception 'A quote cannot be moved to another request or professional.'
      using errcode = 'check_violation';
  end if;

  if v_caller_is_owner then
    -- The owner may revise the price only while the customer has not accepted.
    if old.status = 'accepted' then
      raise exception 'This quote was accepted and can no longer be changed.'
        using errcode = 'check_violation';
    end if;
    return new;
  end if;

  if v_caller_is_admin then
    return new;
  end if;

  -- Everyone else here is the customer answering.
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

drop trigger if exists quotes_protect_terms on public.quotes;
create trigger quotes_protect_terms
  before update on public.quotes
  for each row execute function public.quotes_protect_terms();
