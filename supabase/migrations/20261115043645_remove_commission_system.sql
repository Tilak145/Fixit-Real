-- Already applied to the live database on 2026-11-15, outside this project.
-- Saved here so the project matches the database.
--
-- NOTE: the website code still has screens that read the tables dropped below
-- (lib/commission.ts, components/fixit/commission-section.tsx,
-- features/admin/commissions.tsx). They fail quietly; they need to be removed.

-- Pro trust page: same columns as before, but no longer reads commission disputes.
create or replace view public.provider_trust_evidence as
 SELECT id AS provider_id,
    business_name,
    status,
    license_status,
    license_verified_at,
    license_status = 'lookup_verified'::text AS license_checked,
    insurance_status,
    insurance_verified_at,
    insurance_status = 'verified'::text AS insurance_checked,
    (EXISTS ( SELECT 1 FROM public.provider_documents d
          WHERE d.auth_user_id = p.auth_user_id AND d.kind = 'insurance'::text)) AS insurance_on_file,
    COALESCE(( SELECT count(*) FROM public.job_reports jr
          WHERE jr.provider_id = p.id AND jr.outcome = 'completed'::text AND jr.verification_status = 'verified'::text), 0::bigint) AS verified_jobs,
    COALESCE(( SELECT count(*) FROM public.job_reports jr
          WHERE jr.provider_id = p.id AND jr.outcome = 'completed'::text AND jr.verification_status <> 'verified'::text), 0::bigint) AS unverified_jobs,
    ( SELECT round(percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY ((EXTRACT(epoch FROM q.created_at - qr.created_at) / 3600.0)::double precision))::numeric, 1)
           FROM public.quotes q JOIN public.quote_requests qr ON qr.id = q.quote_request_id
          WHERE q.provider_id = p.id) AS median_response_hours,
    COALESCE(( SELECT count(DISTINCT q.quote_request_id) FROM public.quotes q WHERE q.provider_id = p.id), 0::bigint) AS quotes_sent,
    COALESCE(( SELECT count(*) FROM public.appointments a WHERE a.provider_id = p.id AND a.status = 'completed'::text), 0::bigint) AS visits_completed,
    COALESCE(( SELECT count(*) FROM public.appointments a WHERE a.provider_id = p.id AND a.status = 'cancelled'::text), 0::bigint) AS visits_cancelled,
    COALESCE(( SELECT count(*) FROM public.reviews r WHERE r.provider_id = p.id), 0::bigint) AS review_count,
    COALESCE(( SELECT round(avg(r.rating), 2) FROM public.reviews r WHERE r.provider_id = p.id), 0::numeric) AS review_average,
    ( SELECT max(r.created_at) FROM public.reviews r WHERE r.provider_id = p.id) AS last_review_at,
    0::bigint AS disputes_raised,
    0::bigint AS disputes_resolved,
    COALESCE(( SELECT count(*) FROM public.fraud_reviews f
          WHERE f.subject_type = 'provider'::text AND f.subject_id = p.id AND f.status = 'upheld'::text), 0::bigint) AS upheld_complaints,
    created_at AS joined_at
   FROM public.providers p
  WHERE status = 'approved'::text;

-- Owner dashboard no longer offers a Commissions screen.
create or replace function public.my_workspace_permissions()
 returns text[]
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
begin
  if (select public.is_owner()) then
    return public.default_staff_permissions()
      || array['customer_lookup', 'trial_reminders', 'service_waitlist',
               'accounts', 'team', 'service_cities', 'service_categories']::text[];
  end if;
  return coalesce((select public.my_staff_permissions()), public.default_staff_permissions());
end;
$function$;

-- Remove the commission machinery itself (all tables were empty).
drop trigger if exists sync_job_commission on public.job_reports;
drop function if exists public.sync_job_commission();
drop function if exists public.commission_amount(bigint, bigint, integer, bigint);
drop function if exists public.commission_for_plan(text);
drop table if exists public.commission_disputes;
drop table if exists public.commissions;
drop table if exists public.commission_settings;
