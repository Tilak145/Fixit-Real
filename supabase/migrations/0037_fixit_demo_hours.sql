-- Give the platform's own demo listings real working hours.
--
-- The seeded profiles in 0002 have no auth account: they are FixIt's own demo
-- content, not a real business. They had no hours either, and after this change
-- a pro with no published hours is shown as "Hours on request" rather than a
-- false "Available Today", so the marketplace would look empty of available
-- pros even though the feature works. This fills in the demo listings so the
-- availability filter and badges have something true to show.
--
-- Only rows with no auth_user_id are touched. A real professional's hours are
-- theirs to set and this migration must never invent them.

insert into public.provider_availability (provider_id, weekday, start_minute, end_minute)
select p.id, day.weekday, day.start_minute, day.end_minute
from public.providers p
cross join (
  values
    (1, 480, 1080),  -- Monday    8:00 AM – 6:00 PM
    (2, 480, 1080),  -- Tuesday   8:00 AM – 6:00 PM
    (3, 480, 1080),  -- Wednesday 8:00 AM – 6:00 PM
    (4, 480, 1080),  -- Thursday  8:00 AM – 6:00 PM
    (5, 480, 1080),  -- Friday    8:00 AM – 6:00 PM
    (6, 540, 840)    -- Saturday  9:00 AM – 2:00 PM
) as day(weekday, start_minute, end_minute)
where p.auth_user_id is null
on conflict (provider_id, weekday) do nothing;

-- Two of the demo listings also advertise the after-hours work the emergency
-- filter looks for, so a customer can see that route working end to end. This
-- is a claim on FixIt's own demo profiles, which is the platform's to make.
update public.providers
set accepts_emergency = true
where auth_user_id is null
  and business_name in ('Akron Plumbing Pros', 'Elite HVAC Solutions');
