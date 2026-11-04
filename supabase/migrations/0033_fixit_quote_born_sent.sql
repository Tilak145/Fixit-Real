-- A professional could insert a quote whose status was already 'accepted',
-- which unlocked the customer's contact details without the customer ever
-- agreeing to anything. The update guard in 0031/0032 cannot see an INSERT, so
-- the check has to happen there too.
--
-- A quote is born 'sent'. Whoever answers it is the customer, and that is an
-- update, which the existing guard already polices.

create or replace function public.quotes_born_sent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- A server-side write with no end-user identity is not the professional
  -- filling in the form; it is the platform maintaining its own data.
  if (select auth.uid()) is null then
    return new;
  end if;
  if (select public.is_admin()) then
    return new;
  end if;
  if new.status is distinct from 'sent' then
    raise exception 'A quote is sent, not answered. Only the customer can accept it.'
      using errcode = 'check_violation';
  end if;
  if new.responded_at is not null then
    raise exception 'A new quote cannot already carry a response.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists quotes_born_sent on public.quotes;
create trigger quotes_born_sent
  before insert on public.quotes
  for each row execute function public.quotes_born_sent();
