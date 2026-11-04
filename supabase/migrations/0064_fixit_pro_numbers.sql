-- A permanent nine-digit FixIt number for every business.
--
-- A customer on the phone says "my plumber is FixIt pro 304 215 887", and a
-- manager can pull the business up without a name match. It is deliberately
-- nine digits: long enough that a business number is never confused with a
-- six-digit customer number, and never with a state contractor licence, which
-- is a different thing and is printed with its own label.
--
-- Only the professional and the dashboard see it. The public profile does not
-- show it, so it cannot become a scraped list of every business on FixIt.
--
-- The number is assigned by the database, never typed, and never changed:
-- nothing in the app may write this column after it is set, because a number
-- given to a customer on an invoice has to keep working.

alter table public.providers
  add column if not exists pro_number bigint;

create unique index if not exists providers_pro_number_key
  on public.providers (pro_number)
  where pro_number is not null;

comment on column public.providers.pro_number is
  'Permanent FixIt business number, nine digits. Never a state licence number. Set once and never changed.';

-- Start in the 300,000,000 range so the number is always nine digits when read,
-- with no leading zero; 699,999,999 numbers before it runs out.
create or replace function public.assign_pro_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate bigint;
  attempts int := 0;
begin
  if new.pro_number is not null then
    return new;
  end if;
  -- Spread the numbers rather than handing out 300000001, 300000002…, so the
  -- next business is not a guessable count of how many FixIt has.
  candidate := 300000000 + ((abs(hashtext(new.id::text))::bigint * 7919) % 400000000);
  loop
    exit when not exists (select 1 from public.providers p where p.pro_number = candidate);
    candidate := case when candidate >= 699999999 then 300000000 else candidate + 1 end;
    attempts := attempts + 1;
    if attempts > 400000000 then
      raise exception 'No business numbers are available.';
    end if;
  end loop;
  new.pro_number := candidate;
  return new;
end;
$$;

drop trigger if exists providers_assign_pro_number on public.providers;
create trigger providers_assign_pro_number
  before insert on public.providers
  for each row execute function public.assign_pro_number();

-- A number that has been issued is permanent. A rename, a plan change or a new
-- owner on the same business must not change what a customer was told.
create or replace function public.providers_keep_pro_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.pro_number is not null and new.pro_number is distinct from old.pro_number then
    raise exception 'A FixIt business number cannot be changed once it is issued.';
  end if;
  return new;
end;
$$;

drop trigger if exists providers_keep_pro_number on public.providers;
create trigger providers_keep_pro_number
  before update of pro_number on public.providers
  for each row execute function public.providers_keep_pro_number();

-- Number every business that already exists, including the demo ones: the
-- numbers may be shared with customers, so they must never be reissued later.
alter table public.providers disable trigger providers_assign_pro_number;
do $$
declare
  row_id uuid;
  candidate bigint;
begin
  for row_id in select id from public.providers where pro_number is null loop
    candidate := 300000000 + ((abs(hashtext(row_id::text))::bigint * 7919) % 400000000);
    while exists (select 1 from public.providers where pro_number = candidate) loop
      candidate := case when candidate >= 699999999 then 300000000 else candidate + 1 end;
    end loop;
    update public.providers set pro_number = candidate where id = row_id;
  end loop;
end;
$$;
alter table public.providers enable trigger providers_assign_pro_number;

-- A manager can find a business by its number, the way Find customer works.
create or replace function public.pro_by_number(p_number bigint)
returns table (
  id uuid,
  business_name text,
  pro_number bigint,
  email text,
  phone text,
  status text,
  plan text,
  city_list text,
  service_list text,
  joined_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select public.is_admin()) then
    raise exception 'Only dashboard staff may look up a business.';
  end if;
  return query
    select
      p.id,
      p.business_name::text,
      p.pro_number,
      p.email::text,
      p.phone::text,
      p.status::text,
      p.plan::text,
      (select string_agg(a.city, ', ' order by a.city) from public.provider_service_areas a where a.provider_id = p.id),
      (select string_agg(s.category_slug, ', ' order by s.category_slug) from public.provider_services s where s.provider_id = p.id),
      p.created_at
    from public.providers p
    where p.pro_number = p_number;
end;
$$;

revoke all on function public.pro_by_number(bigint) from public;
grant execute on function public.pro_by_number(bigint) to authenticated;

-- Readable to the professional who owns it; the dashboard's policy already
-- covers the rest.
grant select (pro_number) on public.providers to authenticated;
