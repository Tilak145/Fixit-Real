-- Changing the evidence withdraws the confirmation.
--
-- 0042's guard reset the licence status when a professional edited their own
-- row, but left the confirmation date and the verifier behind. The badge was
-- still correct, because it reads the status — but a date saying "confirmed on
-- the 27th" next to an unconfirmed number is exactly the kind of half-truth
-- this feature exists to remove. Editing the number, or the insurance, now
-- clears the confirmation with it.

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
      new.license_verified_at := null;
      new.license_verified_by := null;
      new.insurance_status := 'unverified';
      new.insurance_verified_at := null;
      new.insurance_verified_by := null;
    else
      if new.license_status is distinct from old.license_status
         or new.license_note is distinct from old.license_note
         or new.license_number is distinct from old.license_number then
        new.license_status := 'unverified';
        new.license_note := null;
        new.license_checked_at := null;
        new.license_verified_at := null;
        new.license_verified_by := null;
      end if;
      if new.insurance_status is distinct from old.insurance_status
         or new.insurance_verified_at is distinct from old.insurance_verified_at
         or new.insurance_verified_by is distinct from old.insurance_verified_by then
        new.insurance_status := 'unverified';
        new.insurance_verified_at := null;
        new.insurance_verified_by := null;
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists providers_guard_license_status on public.providers;
create trigger providers_guard_license_status
  before insert or update on public.providers
  for each row execute function public.providers_guard_license_status();
