
-- A professional can say a lead was not worth their time, and a person decides.
--
-- FixIt does not charge per lead, so this is not a refund request. It is the
-- other half of the fair-lead promise: when a request turns out to be fake,
-- out of area or already done, the professional says so in one place and
-- management looks at it. The outcome is recorded against the lead, so the
-- same fake customer shows up in review rather than being reported again and
-- again by every professional who sees it.

create table if not exists public.lead_disputes (
  id uuid primary key default gen_random_uuid(),
  quote_request_id uuid not null references public.quote_requests(id) on delete cascade,
  provider_id uuid not null references public.providers(id) on delete cascade,
  reason text not null check (reason in (
    'fake', 'duplicate', 'out_of_area', 'wrong_trade', 'already_done', 'unreachable', 'other'
  )),
  detail text,
  status text not null default 'open' check (status in ('open', 'upheld', 'rejected')),
  decision_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  -- One professional reports a given lead once.
  unique (quote_request_id, provider_id)
);

create index if not exists lead_disputes_status_idx on public.lead_disputes (status, created_at desc);
create index if not exists lead_disputes_request_idx on public.lead_disputes (quote_request_id);

alter table public.lead_disputes enable row level security;

-- A professional writes and reads their own reports; management reads all and
-- decides. Nobody edits another professional's words.
drop policy if exists lead_disputes_provider_insert on public.lead_disputes;
create policy lead_disputes_provider_insert on public.lead_disputes
  for insert to authenticated
  with check (
    provider_id in (select id from public.providers where auth_user_id = (select auth.uid()))
    and status = 'open'
  );

drop policy if exists lead_disputes_own_or_admin_read on public.lead_disputes;
create policy lead_disputes_own_or_admin_read on public.lead_disputes
  for select to authenticated
  using (
    (select public.is_admin())
    or provider_id in (select id from public.providers where auth_user_id = (select auth.uid()))
  );

drop policy if exists lead_disputes_admin_update on public.lead_disputes;
create policy lead_disputes_admin_update on public.lead_disputes
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

grant select, insert on public.lead_disputes to authenticated;
grant update on public.lead_disputes to authenticated;

