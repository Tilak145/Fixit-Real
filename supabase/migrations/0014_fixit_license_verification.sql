-- A professional must show a licence number before the dashboard lists them, and
-- the dashboard should be able to check it rather than trust the typing.
--
-- There is no automated state-registry lookup here: that needs an official
-- Ohio records API and an account to reach it, which this project does not
-- have. What the database can honestly do is check the shape of the number,
-- catch the same number being used twice, and record the result. The owner
-- sees that verdict next to the licence on the approval card and makes the
-- final call. If a registry lookup is added later, it records into the same
-- `license_status` / `license_checked_at` columns and nothing else changes.

alter table public.providers
  add column if not exists license_number text,
  add column if not exists license_status text not null default 'unverified'
    check (license_status in ('unverified', 'format_ok', 'format_invalid', 'lookup_verified', 'lookup_failed')),
  add column if not exists license_note text,
  add column if not exists license_checked_at timestamptz;

-- Two providers claiming one licence is the clearest sign something is wrong.
create unique index if not exists providers_license_number_key
  on public.providers (upper(regexp_replace(coalesce(license_number, ''), '[^A-Za-z0-9]', '', 'g')))
  where coalesce(license_number, '') <> '';

/**
 * Check a licence number's shape and uniqueness, then remember the verdict.
 *
 *   format_ok        looks like a licence (letters and digits, 4-24 chars)
 *   format_invalid   empty, too short, too long, or not a real-looking token
 *   lookup_failed    the number is already held by another provider
 *
 * SECURITY DEFINER because it writes a column the caller may not otherwise
 * touch, and it checks the caller is dashboard staff first. The provider's own
 * row and the project owner's row are both readable, so the caller only passes
 * an id, never the number to compare against.
 */
create or replace function public.check_provider_license(provider_id uuid)
returns table (status text, note text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  raw text;
  compact text;
  verdict text;
  message text;
  duplicate boolean;
begin
  if not (select public.is_admin()) then
    raise exception 'Only dashboard staff may check a licence.';
  end if;

  select p.license_number into raw from public.providers p where p.id = provider_id;
  if not found then
    raise exception 'No provider with that id.';
  end if;

  compact := upper(regexp_replace(coalesce(raw, ''), '[^A-Za-z0-9]', '', 'g'));

  if raw is null or btrim(raw) = '' then
    verdict := 'format_invalid';
    message := 'No licence number was supplied.';
  elsif length(compact) < 4 or length(compact) > 24 then
    verdict := 'format_invalid';
    message := 'A licence number should be 4 to 24 letters and digits.';
  elsif compact !~ '^[A-Z0-9]+$' then
    verdict := 'format_invalid';
    message := 'Use letters and digits only.';
  elsif compact !~ '[0-9]' then
    verdict := 'format_invalid';
    message := 'A licence number should contain at least one digit.';
  else
    select exists (
      select 1 from public.providers p
      where p.id <> provider_id
        and p.license_number is not null
        and upper(regexp_replace(p.license_number, '[^A-Za-z0-9]', '', 'g')) = compact
    ) into duplicate;

    if duplicate then
      verdict := 'lookup_failed';
      message := 'Another professional already uses this licence number.';
    else
      verdict := 'format_ok';
      message := 'Looks like a valid licence number. Confirm it against the state register before approving.';
    end if;
  end if;

  update public.providers
  set license_status = verdict,
      license_note = message,
      license_checked_at = now()
  where id = provider_id;

  return query select verdict, message;
end;
$$;

revoke all on function public.check_provider_license(uuid) from public;
grant execute on function public.check_provider_license(uuid) to authenticated;
