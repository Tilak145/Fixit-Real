-- A short, unique customer number, and the manager's window into one customer.
--
-- A homeowner on the phone cannot read out a UUID, and a manager cannot search
-- by one. A six-digit number is short enough to say out loud and look up in the
-- dashboard, which is what "I am calling about my account" needs.
--
-- The number is assigned by the database, never typed: a customer row is
-- created the moment they first save their details or sign up, and the trigger
-- allocates the next free number. Six digits allow 900,000 accounts (100000 to
-- 999999); leading zeros are avoided so the number is always six characters
-- long when read aloud. Collisions are resolved with a retry, and a unique
-- index is the final guarantee that two customers never share one.

alter table public.customer_profiles
  add column if not exists customer_number integer;

create unique index if not exists customer_profiles_number_key
  on public.customer_profiles (customer_number)
  where customer_number is not null;

-- The allocator. A deterministic-ish start derived from the clock, then linear
-- probing until a free number is found. It runs as the owner so a customer can
-- be given a number without being able to read anyone else's.
create or replace function public.assign_customer_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate int;
  attempts int := 0;
begin
  if new.customer_number is not null then
    return new;
  end if;
  -- Spread numbers out rather than handing out 100000, 100001… in sequence, so
  -- the next customer id is not a guessable public count of the business.
  candidate := 100000 + (abs(hashtext(new.user_id::text)) % 900000);
  loop
    exit when not exists (
      select 1 from public.customer_profiles p where p.customer_number = candidate
    );
    candidate := case when candidate >= 999999 then 100000 else candidate + 1 end;
    attempts := attempts + 1;
    if attempts > 900000 then
      raise exception 'No customer numbers are available.';
    end if;
  end loop;
  new.customer_number := candidate;
  return new;
end;
$$;

drop trigger if exists customer_profiles_assign_number on public.customer_profiles;
create trigger customer_profiles_assign_number
  before insert on public.customer_profiles
  for each row execute function public.assign_customer_number();

-- Give the existing customers numbers. A bulk update needs the trigger disabled
-- on the statement: the allocator sees the other rows only after they exist, so
-- backfilling in one pass would otherwise hand the same number to several people.
alter table public.customer_profiles disable trigger customer_profiles_assign_number;
update public.customer_profiles
set customer_number = null
where customer_number is not null and customer_number < 100000;
alter table public.customer_profiles enable trigger customer_profiles_assign_number;

do $$
declare
  row_record record;
  candidate int;
  taken int;
begin
  for row_record in
    select user_id from public.customer_profiles where customer_number is null order by created_at
  loop
    candidate := 100000 + (abs(hashtext(row_record.user_id::text)) % 900000);
    loop
      select count(*) into taken from public.customer_profiles p where p.customer_number = candidate;
      exit when taken = 0;
      candidate := case when candidate >= 999999 then 100000 else candidate + 1 end;
    end loop;
    update public.customer_profiles set customer_number = candidate where user_id = row_record.user_id;
  end loop;
end;
$$;

-- The customer's own number, for the account page. Column-level read only; the
-- rest of the table keeps its existing row-level rules.
grant select (customer_number) on public.customer_profiles to authenticated;

-- ---------------------------------------------------------------------------
-- What a manager sees for one customer number.
--
-- One function, one query, so the dashboard cannot forget a table and show a
-- partial history. It returns only facts this product already holds about the
-- person's own activity: the account, every request they sent, the professionals
-- they chose, the visits those became and the reviews they wrote — plus a count
-- of what a professional did in response, which is what "track everything"
-- means for a customer.
--
-- Admin only. The manager reads this; nobody else can call it for another user.
-- ---------------------------------------------------------------------------
create or replace function public.customer_activity(p_number int)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_profile record;
  v_result jsonb;
begin
  if not (select public.is_admin()) then
    raise exception 'Only dashboard staff may look up a customer.';
  end if;

  select * into v_profile
  from public.customer_profiles p
  where p.customer_number = p_number;

  if v_profile.user_id is null then
    return null;
  end if;
  v_user := v_profile.user_id;

  select jsonb_build_object(
    'customer', jsonb_build_object(
      'user_id', v_user,
      'customer_number', v_profile.customer_number,
      'full_name', v_profile.full_name,
      'phone', v_profile.phone,
      'address', v_profile.address,
      'city', v_profile.city,
      'joined_at', v_profile.created_at,
      'requests', (select count(*) from public.quote_requests q where q.customer_user_id = v_user),
      'quotes_received', (
        select count(*) from public.quotes qt
        join public.quote_requests q on q.id = qt.quote_request_id
        where q.customer_user_id = v_user
      ),
      'visits', (
        select count(*) from public.appointments a
        join public.quote_requests q on q.id = a.quote_request_id
        where q.customer_user_id = v_user
      ),
      'reviews', (select count(*) from public.reviews r where r.author_user_id = v_user)
    ),
    'requests', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', q.id,
        'category_slug', q.category_slug,
        'description', q.description,
        'city', q.city,
        'status', q.status,
        'is_emergency', q.is_emergency,
        'created_at', q.created_at,
        'provider', (select p.business_name from public.providers p where p.id = q.claimed_by),
        'quotes', (
          select count(*) from public.quotes qt where qt.quote_request_id = q.id
        ),
        'accepted_price_cents', (
          select qt.amount_cents from public.quotes qt
          where qt.quote_request_id = q.id and qt.status = 'accepted'
          limit 1
        ),
        'visits', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'id', a.id,
            'title', a.title,
            'scheduled_for', a.scheduled_for,
            'status', a.status
          ) order by a.scheduled_for), '[]'::jsonb)
          from public.appointments a where a.quote_request_id = q.id
        ),
        'review', (
          select jsonb_build_object(
            'id', r.id,
            'rating', r.rating,
            'comment', r.comment,
            'created_at', r.created_at
          )
          from public.reviews r
          where r.author_user_id = v_user and r.provider_id = q.claimed_by
          order by r.created_at desc limit 1
        )
      ) order by q.created_at desc)
      from public.quote_requests q
      where q.customer_user_id = v_user
    ), '[]'::jsonb),
    'reviews', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id,
        'provider', (select p.business_name from public.providers p where p.id = r.provider_id),
        'rating', r.rating,
        'comment', r.comment,
        'created_at', r.created_at
      ) order by r.created_at desc)
      from public.reviews r
      where r.author_user_id = v_user
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.customer_activity(int) from public;
grant execute on function public.customer_activity(int) to authenticated;

-- The manager's search needs the number to be findable by staff only; the
-- customer_profiles_admin policy already allows admins to read every row.

-- Backfill: every existing account that has ever sent a request but never saved
-- details gets a profile row (and therefore a number) now.
insert into public.customer_profiles (user_id, full_name, phone, address, city)
select distinct on (q.customer_user_id)
  q.customer_user_id,
  nullif(btrim(q.customer_name), ''),
  nullif(btrim(q.customer_phone), ''),
  nullif(btrim(q.customer_address), ''),
  nullif(btrim(q.city), '')
from public.quote_requests q
where q.customer_user_id is not null
order by q.customer_user_id, q.created_at desc
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------------
-- A number from the very first moment, whichever comes first.
--
-- A customer row is written when they save details, but many people sign up and
-- go straight to a quote request without touching their profile. Waiting for
-- them to edit a profile would leave exactly those people without a number, so
-- three paths now create it:
--
--   * sign-up            an auth user is created, and the trigger on auth.users
--                        writes their profile row, which is in turn numbered;
--   * their first request the request trigger ensures a profile row exists;
--   * any save           the existing upsert in the app is already numbered.
-- ---------------------------------------------------------------------------
create or replace function public.customer_profiles_on_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- A provider account is not a customer account; it changes nothing here, but
  -- the insert is harmless and keeps the row (and its number) ready either way.
  insert into public.customer_profiles (user_id, full_name, phone, address, city)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    nullif(new.raw_user_meta_data ->> 'address', ''),
    nullif(new.raw_user_meta_data ->> 'city', '')
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists customer_profiles_on_signup on auth.users;
create trigger customer_profiles_on_signup
  after insert on auth.users
  for each row execute function public.customer_profiles_on_signup();

-- A request from a signed-in customer who has no profile row yet gets one, so
-- the number they will quote on the phone exists from their first request.
create or replace function public.quote_requests_ensure_customer_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.customer_user_id is null then
    return new;
  end if;
  insert into public.customer_profiles (user_id, full_name, phone, address, city)
  values (
    new.customer_user_id,
    nullif(btrim(new.customer_name), ''),
    nullif(btrim(new.customer_phone), ''),
    nullif(btrim(new.customer_address), ''),
    nullif(btrim(new.city), '')
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists quote_requests_ensure_customer_profile on public.quote_requests;
create trigger quote_requests_ensure_customer_profile
  after insert on public.quote_requests
  for each row execute function public.quote_requests_ensure_customer_profile();

