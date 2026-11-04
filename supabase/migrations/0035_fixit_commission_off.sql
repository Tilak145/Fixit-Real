-- FixIt charges a monthly subscription only. The completed-job commission is
-- turned off, not removed.
--
-- The decision: launching with both a subscription and a percentage of the job
-- was asking a contractor to take a hidden tax on work FixIt never handled and
-- cannot verify. FixIt does not process the payment for the job, so the
-- completed value is whatever the contractor reports, and a rate charged on
-- that invites disputes and under-reporting. The honest launch offer is a flat
-- monthly fee with no per-lead charge and no commission, which is also a clear
-- difference from the per-lead marketplaces.
--
-- The dial stays. commission_rate_bps, the per-plan rows, the lead allowance,
-- the ledger and the job reports all keep working; the rate is simply zero, so
-- every completed job now settles at nothing owed. Moving a plan's rate back up
-- later is a one-line settings change, with no code and no schema change: the
-- rate is copied onto each lead as it is counted, so a future change never
-- rewrites the terms of a job already done.

insert into public.commission_settings (plan_key, commission_rate_bps, commission_cap_cents, included_leads, updated_at)
values
  ('default',      0, 25000, 0,  now()),
  ('founding',     0, 25000, 25, now()),
  ('starter',      0, 25000, 10, now()),
  ('professional', 0, 25000, 15, now()),
  ('business',     0, 25000, 25, now())
on conflict (plan_key) do update
  set commission_rate_bps = 0,
      updated_at = now();

-- A rate of zero is a valid setting, not a missing one; the check already allows
-- 0 through 10000, so this insert is the whole change. Existing lead_ledger rows
-- keep the rate they were counted at, which is deliberate: the terms of a job a
-- contractor already did do not change under them.
