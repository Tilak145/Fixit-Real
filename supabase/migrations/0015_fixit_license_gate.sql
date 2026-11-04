-- The licence verdict must come from the check, not from the applicant. A
-- provider may edit their own row (0001), so without this they could set
-- license_status to a passing value and walk through approval.
--
-- Keep the rule in the database: a verdict is trusted only when it was written
-- by dashboard staff. Anyone else's write resets the row to 'unverified', so
-- Approve stays off until the check actually runs.

-- The check is the sanctioned writer, so it marks its own write with a
-- transaction-local flag that the guard above honours.
create or replace function public.providers_guard_license_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.is_admin())
     and coalesce(current_setting('spk.license_check', true), '') <> 'on' then
    if tg_op = 'INSERT' then
      new.license_status := 'unverified';
      new.license_note := null;
      new.license_checked_at := null;
    elsif new.license_status is distinct from old.license_status
       or new.license_note is distinct from old.license_note
       or new.license_number is distinct from old.license_number then
      new.license_status := 'unverified';
      new.license_note := null;
      new.license_checked_at := null;
    end if;
  end if;
  return new;
end;
$$;

-- check_provider_license sets the flag for its own write.
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

  perform set_config('spk.license_check', 'on', true);
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
