-- Already applied to the live database on 2026-11-15, outside this project.
-- Saved here so the project matches the database.

alter table public.providers add column if not exists founding_trial_used boolean not null default false;
update public.providers set founding_trial_used = true where trial_ends_at is not null;

-- Pros cannot approve themselves or move their own free-trial date.
-- Staff, and the platform itself (no signed-in user), are unaffected.
create or replace function public.providers_lock_staff_fields()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  if (select auth.uid()) is null or (select public.is_admin()) then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.status := 'pending';
    new.trial_ends_at := null;
    new.founding_locked_until := null;
    new.founding_trial_used := false;
  else
    new.status := old.status;
    new.trial_ends_at := old.trial_ends_at;
    new.founding_locked_until := old.founding_locked_until;
    new.founding_trial_used := old.founding_trial_used;
  end if;
  return new;
end;
$function$;

revoke execute on function public.providers_lock_staff_fields() from public, anon, authenticated;

-- Named to run before the other provider checks.
drop trigger if exists providers_a_lock_staff_fields on public.providers;
create trigger providers_a_lock_staff_fields
  before insert or update on public.providers
  for each row execute function public.providers_lock_staff_fields();

-- The free founding month can be claimed once per pro.
create or replace function public.providers_guard_founding()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  taken int;
begin
  if new.plan = 'founding' and (tg_op = 'INSERT' or old.plan is distinct from 'founding') then
    if tg_op = 'UPDATE' and old.founding_trial_used
       and (select auth.uid()) is not null and not (select public.is_admin()) then
      raise exception 'Your free founding month has already been used. Please choose a paid plan.';
    end if;
    select count(*)::int into taken from public.providers where plan = 'founding';
    if taken >= public.founding_cap() then
      raise exception 'The free founding places are all taken.';
    end if;
    new.founding_locked_until := (now() + interval '1 year')::date;
    -- One month free from the moment the place is claimed.
    new.trial_ends_at := now() + interval '1 month';
    new.founding_trial_used := true;
  elsif new.plan is distinct from 'founding' then
    new.founding_locked_until := null;
    new.trial_ends_at := null;
  end if;
  return new;
end;
$function$;
