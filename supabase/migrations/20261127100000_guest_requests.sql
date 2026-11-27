-- A visitor can send a request without signing up. They are given a customer
-- number straight away. When they later create an account with the SAME email
-- and confirm it, their requests move into the account and they keep the number.
--
-- The number is a reference only: it opens nothing by itself, because six digits
-- can be guessed. Proof of ownership is the confirmed email.

create table if not exists public.guest_customers (
  email text primary key,
  customer_number integer not null unique,
  created_at timestamptz not null default now(),
  claimed_by uuid references auth.users (id) on delete set null,
  claimed_at timestamptz
);

alter table public.guest_customers enable row level security;
revoke all on table public.guest_customers from anon, authenticated;
-- No policies: only the functions below read or write it.

-- Account sign-ups must never be handed a number a guest already holds.
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
  perform pg_advisory_xact_lock(hashtext('fixit.customer_number'));
  candidate := 100000 + (abs(hashtext(new.user_id::text)) % 900000);
  loop
    exit when not exists (select 1 from public.customer_profiles p where p.customer_number = candidate)
      and not exists (select 1 from public.retired_customer_numbers r where r.customer_number = candidate)
      and not exists (select 1 from public.guest_customers g where g.customer_number = candidate);
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

-- The one way a visitor without an account can save a request. It checks the
-- fields, limits how often it can be used, and returns the customer number.
create or replace function public.submit_guest_request(p jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p ->> 'customer_email', '')));
  v_name text := btrim(coalesce(p ->> 'customer_name', ''));
  v_phone text := btrim(coalesce(p ->> 'customer_phone', ''));
  v_city text := btrim(coalesce(p ->> 'city', ''));
  v_category text := btrim(coalesce(p ->> 'category_slug', ''));
  v_description text := btrim(coalesce(p ->> 'description', ''));
  v_address text := nullif(btrim(coalesce(p ->> 'customer_address', '')), '');
  v_digits text := regexp_replace(coalesce(p ->> 'customer_phone', ''), '\D', '', 'g');
  v_min bigint := (p ->> 'budget_min_cents')::bigint;
  v_max bigint := (p ->> 'budget_max_cents')::bigint;
  v_number int;
  v_attempts int := 0;
begin
  if (select auth.uid()) is not null then
    raise exception 'You are signed in, so send the request from your account.';
  end if;
  if v_name = '' or length(v_name) > 120 then
    raise exception 'Add your name so professionals know who they are quoting.';
  end if;
  if length(v_email) > 200 or v_email !~ '^[^@\s]+@[^@\s]+\.[a-z]{2,}$' then
    raise exception 'Check your email address. It is how you see your prices later.';
  end if;
  -- Without an account the phone number is how a professional can be sure there is a person.
  if length(v_digits) < 10 or length(v_phone) > 40 then
    raise exception 'Add a phone number with area code.';
  end if;
  if length(v_description) < 5 or length(v_description) > 5000 then
    raise exception 'Describe the job in a few words.';
  end if;
  if length(coalesce(v_address, '')) > 300 then
    raise exception 'That address is too long.';
  end if;
  if not exists (select 1 from public.service_cities c where c.label = v_city and c.is_active) then
    raise exception 'Choose one of the cities FixIt serves.';
  end if;
  if v_category not in ('plumbing', 'electrical', 'hvac', 'garage-doors', 'roofing', 'appliance-repair',
                        'handyman', 'cleaning', 'pest-control', 'landscaping') then
    raise exception 'Choose the service you need.';
  end if;
  if exists (select 1 from auth.users u where lower(u.email) = v_email) then
    raise exception 'This email already has a FixIt account. Log in to send your request.';
  end if;

  -- Limits, so the open form cannot be used to flood professionals.
  perform pg_advisory_xact_lock(hashtext('fixit.guest_request'));
  if (select count(*) from public.quote_requests q
      where q.customer_user_id is null and lower(btrim(q.customer_email)) = v_email
        and q.created_at > now() - interval '1 day') >= 3
     or (select count(*) from public.quote_requests q
         where q.customer_user_id is null and regexp_replace(coalesce(q.customer_phone, ''), '\D', '', 'g') = v_digits
           and q.created_at > now() - interval '1 day') >= 3 then
    raise exception 'You have sent several requests today. Create a free account to send more.';
  end if;
  if (select count(*) from public.quote_requests q
      where q.customer_user_id is null and q.created_at > now() - interval '1 hour') >= 30 then
    raise exception 'We are receiving a lot of requests right now. Please create a free account, or try again later.';
  end if;

  select g.customer_number into v_number from public.guest_customers g where g.email = v_email;
  if v_number is null then
    perform pg_advisory_xact_lock(hashtext('fixit.customer_number'));
    v_number := 100000 + floor(random() * 900000)::int;
    loop
      exit when not exists (select 1 from public.customer_profiles c where c.customer_number = v_number)
        and not exists (select 1 from public.retired_customer_numbers r where r.customer_number = v_number)
        and not exists (select 1 from public.guest_customers g where g.customer_number = v_number);
      v_number := case when v_number >= 999999 then 100000 else v_number + 1 end;
      v_attempts := v_attempts + 1;
      if v_attempts > 900000 then
        raise exception 'No customer numbers are available.';
      end if;
    end loop;
    insert into public.guest_customers (email, customer_number) values (v_email, v_number);
  end if;

  insert into public.quote_requests (
    category_slug, description, customer_name, customer_email, customer_phone, city, customer_address,
    customer_user_id, is_emergency, lat, lng, budget_min_cents, budget_max_cents, budget_set_at
  ) values (
    v_category, v_description, v_name, v_email, v_phone, v_city, v_address,
    null, coalesce((p ->> 'is_emergency')::boolean, false),
    (p ->> 'lat')::double precision, (p ->> 'lng')::double precision,
    v_min, v_max, case when v_min is null and v_max is null then null else now() end
  );

  return v_number;
end;
$$;

revoke all on function public.submit_guest_request(jsonb) from public;
grant execute on function public.submit_guest_request(jsonb) to anon;

-- When the email is confirmed, the guest's requests and number become theirs.
create or replace function public.claim_guest_requests()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_number int;
begin
  if new.email is null or new.email_confirmed_at is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.email_confirmed_at is not null then
    return new;
  end if;

  update public.guest_customers
  set claimed_by = new.id, claimed_at = now()
  where email = lower(new.email) and claimed_by is null
  returning customer_number into v_number;
  if v_number is null then
    return new;
  end if;

  insert into public.customer_profiles (user_id) values (new.id) on conflict (user_id) do nothing;
  update public.customer_profiles set customer_number = v_number where user_id = new.id;
  update public.quote_requests
  set customer_user_id = new.id
  where customer_user_id is null and lower(btrim(customer_email)) = lower(new.email);
  return new;
exception when others then
  -- Linking must never stop someone from confirming their account.
  raise warning 'claim_guest_requests failed for %: %', new.id, sqlerrm;
  return new;
end;
$$;

revoke all on function public.claim_guest_requests() from public, anon, authenticated;

-- Named to run after the trigger that creates the customer profile.
drop trigger if exists zz_claim_guest_requests on auth.users;
create trigger zz_claim_guest_requests
  after insert or update of email_confirmed_at on auth.users
  for each row execute function public.claim_guest_requests();
