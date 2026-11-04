-- What FixIt can honestly say about a professional, and who checked it.
--
-- The profile has always shown a green "Verified Professional" badge to every
-- approved professional. That is not true. Approved means the owner let them
-- list; it does not mean a licence was checked against the state register, or
-- that anyone opened their insurance certificate. A trust badge that means
-- "we approved them" teaches homeowners to ignore it, which is worse than
-- having none.
--
-- So the badge is split from the label, and each claim carries its own evidence:
--
--   * a licence shows as checked only after a person confirmed it against the
--     state register, with who checked it and when recorded;
--   * insurance shows as checked only after a person opened the certificate
--     that was uploaded, again with who and when;
--   * completed jobs, response time, visits made, reviews and complaints are
--     counted from what actually happened in the product, not estimated.
--
-- Nothing here can be set by the professional. A provider may edit their own
-- row (0001), and 0015 already resets a licence verdict on any unprivileged
-- write; the same guard now covers insurance, so a pro cannot mark themselves
-- verified.

alter table public.providers
  add column if not exists insurance_status text not null default 'unverified'
    check (insurance_status in ('unverified', 'verified', 'rejected')),
  add column if not exists insurance_verified_at timestamptz,
  add column if not exists insurance_verified_by uuid references auth.users(id) on delete set null,
  add column if not exists license_verified_at timestamptz,
  add column if not exists license_verified_by uuid references auth.users(id) on delete set null;

-- A verified licence now says who confirmed it and when — the difference
-- between "looks like a licence number" and "someone checked it".
update public.providers
set license_status = 'format_ok'
where license_status = 'lookup_verified'
  and license_verified_at is null;

-- Extend the guard from 0015 so an unprivileged write cannot fake insurance
-- either. Only the verification function, which marks its own write, may set a
-- passing state.
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

-- ---------------------------------------------------------------------------
-- Recording a check. One function for both, because the rule is the same:
-- only dashboard staff, and the write records who did it and when.
-- ---------------------------------------------------------------------------
create or replace function public.verify_provider_evidence(
  provider_id uuid,
  evidence text,
  verdict text,
  note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := (select auth.uid());
begin
  if not (select public.is_admin()) then
    raise exception 'Only dashboard staff may verify a professional.';
  end if;

  if evidence = 'license' then
    if verdict not in ('lookup_verified', 'format_ok', 'format_invalid', 'lookup_failed') then
      raise exception 'Unknown licence verdict: %', verdict;
    end if;
    perform set_config('spk.license_check', 'on', true);
    update public.providers
    set license_status = verdict,
        license_note = note,
        license_checked_at = now(),
        -- A passing licence records the person who confirmed it; anything else
        -- clears that claim rather than leaving a stale one behind.
        license_verified_at = case when verdict = 'lookup_verified' then now() else null end,
        license_verified_by = case when verdict = 'lookup_verified' then v_caller else null end
    where id = provider_id;
    return;
  end if;

  if evidence = 'insurance' then
    if verdict not in ('verified', 'rejected', 'unverified') then
      raise exception 'Unknown insurance verdict: %', verdict;
    end if;
    perform set_config('spk.license_check', 'on', true);
    update public.providers
    set insurance_status = verdict,
        insurance_verified_at = case when verdict = 'verified' then now() else null end,
        insurance_verified_by = case when verdict = 'verified' then v_caller else null end
    where id = provider_id;
    return;
  end if;

  raise exception 'Unknown evidence: %', evidence;
end;
$$;

revoke all on function public.verify_provider_evidence(uuid, text, text, text) from public;
grant execute on function public.verify_provider_evidence(uuid, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- The evidence itself, counted from what happened.
--
-- This view exposes only facts about a business: how many jobs were completed
-- and verified, how quickly they answer, how often a booked visit happened, and
-- what reviews and complaints say. No contact details, no addresses, nothing
-- private — which is why it can be readable by anyone.
-- ---------------------------------------------------------------------------
drop view if exists public.provider_trust_evidence;
create view public.provider_trust_evidence as
select
  p.id as provider_id,
  p.business_name,
  p.status,
  -- Licence: 'lookup_verified' is the only state that means someone actually
  -- confirmed it. Everything else is honest about being unconfirmed.
  p.license_status,
  p.license_verified_at,
  (p.license_status = 'lookup_verified') as license_checked,
  -- Insurance: the certificate was opened and accepted by a person.
  p.insurance_status,
  p.insurance_verified_at,
  (p.insurance_status = 'verified') as insurance_checked,
  -- Whether the paperwork needed for this trade exists at all, so a customer can
  -- tell "not verified yet" from "nothing on file".
  exists (
    select 1 from public.provider_documents d
    where d.auth_user_id = p.auth_user_id and d.kind = 'insurance'
  ) as insurance_on_file,
  -- Completed jobs, counted only where management confirmed the job happened.
  coalesce((
    select count(*) from public.job_reports jr
    where jr.provider_id = p.id
      and jr.outcome = 'completed'
      and jr.verification_status = 'verified'
  ), 0) as verified_jobs,
  -- Jobs reported complete and not yet confirmed, counted separately so the
  -- number a customer sees is never inflated by an unconfirmed claim.
  coalesce((
    select count(*) from public.job_reports jr
    where jr.provider_id = p.id
      and jr.outcome = 'completed'
      and jr.verification_status <> 'verified'
  ), 0) as unverified_jobs,
  -- How fast they answer: the median hours from a job being posted to their
  -- price arriving. Only leads they actually quoted count.
  (
    select round(percentile_cont(0.5) within group (
      order by extract(epoch from (q.created_at - qr.created_at)) / 3600.0
    )::numeric, 1)
    from public.quotes q
    join public.quote_requests qr on qr.id = q.quote_request_id
    where q.provider_id = p.id
  ) as median_response_hours,
  coalesce((
    select count(distinct q.quote_request_id) from public.quotes q where q.provider_id = p.id
  ), 0) as quotes_sent,
  -- Visits: booked, completed, cancelled. A visit that happened is the clearest
  -- sign a professional turned up.
  coalesce((
    select count(*) from public.appointments a
    where a.provider_id = p.id and a.status = 'completed'
  ), 0) as visits_completed,
  coalesce((
    select count(*) from public.appointments a
    where a.provider_id = p.id and a.status = 'cancelled'
  ), 0) as visits_cancelled,
  -- Reviews, and how recent the newest one is, so a stale five stars from two
  -- years ago is visibly stale.
  coalesce((
    select count(*) from public.reviews r where r.provider_id = p.id
  ), 0) as review_count,
  coalesce((
    select round(avg(r.rating)::numeric, 2) from public.reviews r where r.provider_id = p.id
  ), 0) as review_average,
  (
    select max(r.created_at) from public.reviews r where r.provider_id = p.id
  ) as last_review_at,
  -- Complaints: disputes raised against this professional and how many were
  -- settled. Shown as counts, never as an accusation.
  coalesce((
    select count(*) from public.commission_disputes d where d.provider_id = p.id
  ), 0) as disputes_raised,
  coalesce((
    select count(*) from public.commission_disputes d
    where d.provider_id = p.id and d.status = 'resolved'
  ), 0) as disputes_resolved,
  -- A fraud review that was dismissed is not held against anyone; only an
  -- upheld one counts.
  coalesce((
    select count(*) from public.fraud_reviews f
    where f.subject_type = 'provider' and f.subject_id = p.id and f.status = 'upheld'
  ), 0) as upheld_complaints,
  p.created_at as joined_at
from public.providers p
where p.status = 'approved';

grant select on public.provider_trust_evidence to anon, authenticated;
