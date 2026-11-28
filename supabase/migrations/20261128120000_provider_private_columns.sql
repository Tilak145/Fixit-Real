-- A professional's contact details, licence and registration numbers and exact
-- location were readable by anyone, signed in or not. They are now readable only
-- by the business that owns them and by FixIt staff, through provider_private().
--
-- IMPORTANT when applying: website and app code that still selects these columns
-- directly stops working, so release the matching code at the same moment.
--
-- Reading is granted column by column from here on: a column added to providers
-- later is not readable through the API until it is granted.

do $$
declare v_public text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into v_public
  from information_schema.columns
  where table_schema = 'public' and table_name = 'providers'
    and column_name not in (
      'email', 'phone', 'address', 'contact_name', 'license_number', 'license_note',
      'business_registration_number', 'lat', 'lng', 'located_at',
      'license_verified_by', 'insurance_verified_by', 'business_registration_checked_by'
    );
  execute 'revoke select on public.providers from anon, authenticated';
  execute format('grant select (%s) on public.providers to anon, authenticated', v_public);
end $$;

create or replace function public.provider_private(p_ids uuid[])
returns table (
  id uuid, email text, phone text, address text, contact_name text, license_number text, license_note text,
  business_registration_number text, lat double precision, lng double precision
)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.email::text, p.phone::text, p.address::text, p.contact_name::text, p.license_number::text,
         p.license_note::text, p.business_registration_number::text, p.lat::double precision, p.lng::double precision
  from public.providers p
  where p.id = any (p_ids)
    and (p.auth_user_id = (select auth.uid()) or (select public.is_admin()));
$$;
revoke all on function public.provider_private(uuid[]) from public, anon;
grant execute on function public.provider_private(uuid[]) to authenticated;
