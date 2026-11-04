-- Customer and business numbers must never be the same number.
--
-- They describe different people, so a six-digit customer number and a
-- nine-digit business number are already different lengths — but lengths are a
-- convention, not a guarantee. Someone could widen the customer range, a
-- backfill could reuse a range, and then a number read out on the phone would
-- pull up the wrong account entirely. That is the mistake worth making
-- impossible, not merely unlikely.
--
-- FixIt therefore keeps two disjoint ranges, and the database refuses anything
-- outside the range it belongs to:
--   customers: 100 000  –  999 999     (six digits, never a leading zero)
--   businesses: 300 000 000 – 699 999 999 (nine digits)
-- A business number can never be six digits, and a customer number can never
-- fall in the business range. Existing numbers were issued inside these ranges,
-- so nothing needs to be renumbered.

-- A shared rule, so both sides read the same definition.
create or replace function public.is_customer_number(p_number bigint)
returns boolean
language sql
immutable
as $$ select p_number between 100000 and 999999 $$;

create or replace function public.is_pro_number(p_number bigint)
returns boolean
language sql
immutable
as $$ select p_number between 300000000 and 699999999 $$;

create or replace function public.is_pro_number(p_number text)
returns boolean
language sql
immutable
as $$ select public.is_pro_number(nullif(regexp_replace(coalesce(p_number, ''), '\D', '', 'g'), '')::bigint) $$;

revoke all on function public.is_customer_number(bigint) from public;
revoke all on function public.is_pro_number(bigint) from public;
revoke all on function public.is_pro_number(text) from public;
grant execute on function public.is_customer_number(bigint) to anon, authenticated;
grant execute on function public.is_pro_number(bigint) to anon, authenticated;
grant execute on function public.is_pro_number(text) to anon, authenticated;

-- The ranges themselves are checked on the row, so a bulk update, a manual fix
-- or a future migration cannot write a number into the wrong family.
alter table public.customer_profiles
  drop constraint if exists customer_profiles_number_range;
alter table public.customer_profiles
  add constraint customer_profiles_number_range
  check (customer_number is null or public.is_customer_number(customer_number::bigint));

alter table public.providers
  drop constraint if exists providers_pro_number_range;
alter table public.providers
  add constraint providers_pro_number_range
  check (pro_number is null or public.is_pro_number(pro_number));

-- A single answer to "what is this number", used by the search that accepts
-- either kind of number: it looks in the customer range for a customer and in
-- the business range for a business, never both.
create or replace function public.number_kind(p_number text)
returns text
language sql
immutable
as $$
  select case
    when public.is_customer_number(nullif(regexp_replace(coalesce(p_number, ''), '\D', '', 'g'), '')::bigint) then 'customer'
    when public.is_pro_number(coalesce(p_number, '')) then 'business'
    else 'unknown'
  end
$$;

revoke all on function public.number_kind(text) from public;
grant execute on function public.number_kind(text) to anon, authenticated;

comment on function public.number_kind(text) is
  'customer, business, or unknown. The two ranges never overlap, so one number is never both.';
