-- 0015 defined the licence guard function but its trigger was lost in an edit,
-- so a provider could still write their own licence verdict. Attach it here.

drop trigger if exists providers_guard_license_status on public.providers;
create trigger providers_guard_license_status
  before insert or update on public.providers
  for each row execute function public.providers_guard_license_status();
