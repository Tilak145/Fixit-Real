-- Leads accepted before the ledger existed were never counted, so a contractor
-- who took a job yesterday would see "0 leads used" today. Backfill them once,
-- using each lead's acceptance time and the plan on the contractor's account
-- now. The insert is guarded by the same unique key as live counting, so
-- re-running this changes nothing.

insert into public.lead_ledger
  (quote_request_id, provider_id, plan_key, allowance_period, allowance_status, rate_bps, cap_cents, counted_at)
select
  q.id,
  q.claimed_by,
  p.plan,
  date_trunc('month', coalesce(q.created_at, now()))::date,
  -- The allowance position is decided below, per contractor and month.
  'included',
  s.rate_bps,
  s.cap_cents,
  coalesce(q.created_at, now())
from public.quote_requests q
join public.providers p on p.id = q.claimed_by
cross join lateral public.commission_for_plan(p.plan) s
where q.claimed_by is not null
on conflict (quote_request_id, provider_id) do nothing;

-- Re-decide which of the backfilled leads fall inside each contractor's
-- included allowance for their month: the earliest leads in the month are the
-- included ones, the rest are commissionable. This is the same rule the live
-- trigger applies, evaluated over the whole month at once.
with ranked as (
  select id,
         row_number() over (partition by provider_id, allowance_period order by counted_at, id) as seq,
         (select s.included_leads
            from public.commission_for_plan(l.plan_key) s) as included
  from public.lead_ledger l
)
update public.lead_ledger l
   set allowance_status = case when r.seq <= coalesce(r.included, 0) then 'included' else 'commissionable' end
  from ranked r
 where r.id = l.id
   and l.allowance_status is distinct from
       case when r.seq <= coalesce(r.included, 0) then 'included' else 'commissionable' end;
