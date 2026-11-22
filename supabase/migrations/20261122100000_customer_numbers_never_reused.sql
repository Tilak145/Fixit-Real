-- A customer number must never belong to two people, now or later.
--
-- The unique index already stops two live customers sharing a number. Two gaps
-- remained:
--   1. When a customer's profile was deleted, its number became free and could be
--      issued to a new customer, so an old email, record or phone note naming
--      that number would point at the wrong person. A number once issued is now
--      retired for good.
--   2. Two sign-ups at the same instant could be offered the same free number;
--      the index refused the second, which then failed. Allocation is now
--      serialised, so each sign-up gets its own number.

create table if not exists public.retired_customer_numbers (
  customer_number integer primary key,
  retired_at timestamptz not null default now()
);

alter table public.retired_customer_numbers enable row level security;
revoke all on table public.retired_customer_numbers from anon, authenticated;

-- Numbers already issued to someone still in the table are in use; the ones that
-- have gone are recorded as they go.
create or replace function public.retire_customer_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.customer_number is not null then
    insert into public.retired_customer_numbers (customer_number)
    values (old.customer_number)
    on conflict do nothing;
  end if;
  return old;
end;
$$;

revoke all on function public.retire_customer_number() from public, anon, authenticated;

drop trigger if exists customer_profiles_retire_number on public.customer_profiles;
create trigger customer_profiles_retire_number
  after delete on public.customer_profiles
  for each row execute function public.retire_customer_number();

-- A number changed on a live profile retires the old one too.
create or replace function public.retire_changed_customer_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.customer_number is not null and new.customer_number is distinct from old.customer_number then
    insert into public.retired_customer_numbers (customer_number)
    values (old.customer_number)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

revoke all on function public.retire_changed_customer_number() from public, anon, authenticated;

drop trigger if exists customer_profiles_retire_changed_number on public.customer_profiles;
create trigger customer_profiles_retire_changed_number
  after update of customer_number on public.customer_profiles
  for each row execute function public.retire_changed_customer_number();

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
  -- One allocation at a time: the next sign-up waits until this one is saved,
  -- then sees its number as taken.
  perform pg_advisory_xact_lock(hashtext('fixit.customer_number'));
  candidate := 100000 + (abs(hashtext(new.user_id::text)) % 900000);
  loop
    exit when not exists (select 1 from public.customer_profiles p where p.customer_number = candidate)
      and not exists (select 1 from public.retired_customer_numbers r where r.customer_number = candidate);
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
