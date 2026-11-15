-- Already applied to the live database on 2026-11-15, outside this project.
-- Saved here so the project matches the database.

-- FixIt is subscription-only: pros never pay per lead or per job.

-- 1. Stop creating commission bills when a job is completed.
drop trigger if exists sync_job_commission on public.job_reports;

-- 2. Every lead a pro takes is included in their plan; nothing is ever "extra".
create or replace function public.record_lead_usage()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_plan text;
begin
  if new.claimed_by is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.claimed_by is not distinct from new.claimed_by then
    return new;
  end if;

  select p.plan into v_plan from public.providers p where p.id = new.claimed_by;
  if v_plan is null then
    return new;
  end if;

  -- Kept only so job reports can link to the lead. Always included, never billed.
  insert into public.lead_ledger
    (quote_request_id, provider_id, plan_key, allowance_period, allowance_status, rate_bps, cap_cents)
  values
    (new.id, new.claimed_by, v_plan, date_trunc('month', now())::date, 'included', 0, null)
  on conflict (quote_request_id, provider_id) do nothing;

  return new;
end;
$function$;

-- 3. Leave every plan at zero, with no lead limit.
update public.commission_settings set commission_rate_bps = 0, commission_cap_cents = null, included_leads = 0;
