-- Already applied to the live database on 2026-11-15, outside this project.
-- Saved here so the project matches the database.

-- Pros cannot approve themselves, move their trial date, or set their own rating.
-- A pro's rating and review count always come from real customer reviews.
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
  select coalesce(round(avg(r.rating), 2), 0), count(*)
    into new.rating, new.review_count
    from public.reviews r
   where r.provider_id = new.id;
  return new;
end;
$function$;
