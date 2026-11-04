
-- Fix the fair-lead screening trigger.
--
-- 0044 wrote its flags from a BEFORE INSERT trigger, where the request row does
-- not exist yet, so the flag insert failed its foreign key and took the whole
-- request down with it. The fingerprint and the duplicate check still belong
-- before the insert; only the flag rows have to wait until the request exists.

create or replace function public.screen_quote_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fingerprint text;
  v_recent integer;
begin
  v_fingerprint := public.quote_request_fingerprint(
    new.customer_name, new.customer_email, new.category_slug, new.city, new.description
  );
  new.fingerprint := v_fingerprint;

  select count(*) into v_recent
  from public.quote_requests q
  where q.fingerprint = v_fingerprint
    and q.created_at > now() - interval '10 minutes'
    and q.id <> new.id;

  if v_recent > 0 then
    raise exception 'This request was already sent a moment ago. We have it - give the professionals a little time to reply.'
      using errcode = 'unique_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists screen_quote_request on public.quote_requests;
create trigger screen_quote_request
  before insert on public.quote_requests
  for each row execute function public.screen_quote_request();

-- The flags are written once the request exists.
create or replace function public.flag_quote_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_flags text[] := '{}';
  v_severity text := 'note';
  v_free_email text;
  v_hourly integer;
begin
  v_free_email := lower(split_part(coalesce(new.customer_email, ''), '@', 2));
  if v_free_email in ('example.com', 'example.org', 'test.com', 'mailinator.com', 'tempmail.com', 'guerrillamail.com') then
    v_flags := array_append(v_flags, 'Disposable or example email address.');
    v_severity := 'suspicious';
  end if;

  if length(btrim(coalesce(new.description, ''))) < 12 then
    v_flags := array_append(v_flags, 'The job description is too short to act on.');
  end if;

  if coalesce(new.customer_phone, '') = '' and coalesce(new.customer_address, '') = '' then
    v_flags := array_append(v_flags, 'No phone number and no service address.');
    v_severity := 'suspicious';
  end if;

  if lower(coalesce(new.description, '')) ~ '(asdf|qwerty|test test|do not quote|ignore this|lorem ipsum)' then
    v_flags := array_append(v_flags, 'The description looks like a test or placeholder.');
    v_severity := 'suspicious';
  end if;

  select count(*) into v_hourly
  from public.quote_requests q
  where lower(btrim(q.customer_email)) = lower(btrim(new.customer_email))
    and q.created_at > now() - interval '1 hour'
    and q.id <> new.id;

  if v_hourly >= 5 then
    v_flags := array_append(v_flags, 'Many requests from this address in the last hour.');
    v_severity := 'suspicious';
  end if;

  if array_length(v_flags, 1) is not null then
    insert into public.lead_flags (quote_request_id, reason, severity)
    select new.id, reason, v_severity from unnest(v_flags) as reason;
  end if;

  return null;
end;
$$;

drop trigger if exists flag_quote_request on public.quote_requests;
create trigger flag_quote_request
  after insert on public.quote_requests
  for each row execute function public.flag_quote_request();

delete from public.quote_requests where customer_name in ('Test Normal', 'Test Sus');

