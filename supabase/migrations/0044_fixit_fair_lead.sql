-- A fair-lead guarantee: what a professional is told, and what they are not.
--
-- The marketplaces this product competes with charge for a lead whether the
-- contractor wins the job or not, and their published terms say so. That is the
-- single complaint contractors repeat, and it is worth designing against
-- directly. FixIt does not charge per lead at all — the subscription is flat —
-- so the guarantee here is about something else a contractor can hold us to:
--
--   * they know what a job is before they spend time on it, including the
--     customer's budget, the location, the photos and the trade;
--   * they can filter to the work they actually want, rather than paying
--     attention to everything;
--   * a request that is a duplicate or looks fake never reaches them;
--   * if a lead is invalid anyway, there is a stated way to say so and a
--     person who decides;
--   * and they can see, in numbers, how their leads turn into quotes and jobs.
--
-- That last one is the honest heart of it: FixIt publishes the conversion a
-- contractor actually gets, rather than a claimed average.

-- ---------------------------------------------------------------------------
-- What the customer is willing to spend.
-- ---------------------------------------------------------------------------
alter table public.quote_requests
  add column if not exists budget_min_cents bigint check (budget_min_cents is null or budget_min_cents >= 0),
  add column if not exists budget_max_cents bigint check (budget_max_cents is null or budget_max_cents >= 0),
  -- A range that runs backwards is a typo, not a budget.
  add column if not exists budget_set_at timestamptz;

alter table public.quote_requests drop constraint if exists quote_requests_budget_range;
alter table public.quote_requests
  add constraint quote_requests_budget_range check (
    budget_min_cents is null
    or budget_max_cents is null
    or budget_max_cents >= budget_min_cents
  );

-- A budget is part of what a professional needs to judge a lead, so it is
-- readable on the same terms as the description and the city.
grant select (budget_min_cents, budget_max_cents) on public.quote_requests to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Duplicate and fake requests.
--
-- A duplicate is the same job sent twice, usually by someone who did not see
-- the confirmation. It wastes a professional's attention and makes the
-- marketplace look broken. A fingerprint of the customer and the job text
-- catches that, and the trigger refuses a second one inside a short window.
--
-- Something that merely looks suspicious is flagged, not blocked: a real person
-- with an unusual email deserves a quote, so a flagged request goes to
-- management rather than into a bin. Flagged requests are withheld from
-- professionals until it is cleared, so nobody spends time on a fake.
-- ---------------------------------------------------------------------------
create or replace function public.quote_request_fingerprint(
  p_customer text,
  p_email text,
  p_category text,
  p_city text,
  p_description text
)
returns text
language sql
immutable
as $$
  select md5(
    lower(btrim(coalesce(p_customer, ''))) || '|' ||
    lower(btrim(coalesce(p_email, ''))) || '|' ||
    coalesce(p_category, '') || '|' ||
    lower(btrim(coalesce(p_city, ''))) || '|' ||
    -- Whitespace and case are noise; the words are the job.
    regexp_replace(lower(coalesce(p_description, '')), '\s+', ' ', 'g')
  );
$$;

alter table public.quote_requests
  add column if not exists fingerprint text;

create index if not exists quote_requests_fingerprint_idx
  on public.quote_requests (fingerprint, created_at desc);

-- A flag for management. Nothing here is a verdict.
create table if not exists public.lead_flags (
  id uuid primary key default gen_random_uuid(),
  quote_request_id uuid not null references public.quote_requests(id) on delete cascade,
  reason text not null,
  -- 'suspicious' withholds the lead from professionals until it is cleared.
  severity text not null default 'note' check (severity in ('note', 'suspicious')),
  status text not null default 'open' check (status in ('open', 'cleared', 'confirmed')),
  note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null
);

create index if not exists lead_flags_request_idx on public.lead_flags (quote_request_id, status);

alter table public.lead_flags enable row level security;

drop policy if exists lead_flags_admin on public.lead_flags;
create policy lead_flags_admin on public.lead_flags
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

grant select, insert, update, delete on public.lead_flags to authenticated;

/**
 * The rules that decide whether a request is a duplicate or looks fake.
 *
 * Runs as the owner so it works whatever the poster's own grants are, and it
 * writes the flag rather than raising, except for a duplicate — a second copy
 * of the same job within ten minutes is almost always a double-submit, and
 * telling the customer at once is kinder than letting a professional chase it.
 */
create or replace function public.screen_quote_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fingerprint text;
  v_recent integer;
  v_hourly integer;
  v_flags text[] := '{}';
  v_severity text := 'note';
  v_free_email text;
begin
  v_fingerprint := public.quote_request_fingerprint(
    new.customer_name, new.customer_email, new.category_slug, new.city, new.description
  );
  new.fingerprint := v_fingerprint;

  -- The same job, from the same person, moments ago: a double-submit.
  select count(*) into v_recent
  from public.quote_requests q
  where q.fingerprint = v_fingerprint
    and q.created_at > now() - interval '10 minutes'
    and q.id <> new.id;

  if v_recent > 0 then
    raise exception 'This request was already sent a moment ago. We have it — give the professionals a little time to reply.'
      using errcode = 'unique_violation';
  end if;

  -- A flagged request is withheld from professionals until it is cleared, so
  -- the whole point of the check is that nothing obvious gets through.
  v_free_email := lower(split_part(coalesce(new.customer_email, ''), '@', 2));
  if v_free_email in ('example.com', 'example.org', 'test.com', 'mailinator.com', 'tempmail.com', 'guerrillamail.com') then
    v_flags := array_append(v_flags, 'Disposable or example email address.');
    v_severity := 'suspicious';
  end if;

  if length(btrim(coalesce(new.description, ''))) < 12 then
    v_flags := array_append(v_flags, 'The job description is too short to act on.');
  end if;

  if coalesce(new.customer_phone, '') = '' and coalesce(new.customer_address, '') = '' then
    v_flags := array_append(v_flags, 'No phone number and no service address.');
    v_severity := 'suspicious';
  end if;

  if lower(coalesce(new.description, '')) ~ '(asdf|qwerty|test test|do not quote|ignore this|lorem ipsum)' then
    v_flags := array_append(v_flags, 'The description looks like a test or placeholder.');
    v_severity := 'suspicious';
  end if;

  -- One person flooding the board: a strong sign of a fake or a bot.
  select count(*) into v_hourly
  from public.quote_requests q
  where lower(btrim(q.customer_email)) = lower(btrim(new.customer_email))
    and q.created_at > now() - interval '1 hour'
    and q.id <> new.id;

  if v_hourly >= 5 then
    v_flags := array_append(v_flags, 'Many requests from this address in the last hour.');
    v_severity := 'suspicious';
  end if;

  if array_length(v_flags, 1) is not null then
    insert into public.lead_flags (quote_request_id, reason, severity)
    select new.id, reason, v_severity from unnest(v_flags) as reason;
  end if;

  return new;
end;
$$;

drop trigger if exists screen_quote_request on public.quote_requests;
create trigger screen_quote_request
  before insert on public.quote_requests
  for each row execute function public.screen_quote_request();

-- Backfill the fingerprints of requests already posted, so the reporting and
-- duplicate checks have a complete picture rather than only new requests.
update public.quote_requests
set fingerprint = public.quote_request_fingerprint(customer_name, customer_email, category_slug, city, description)
where fingerprint is null;

-- ---------------------------------------------------------------------------
-- A flagged request does not reach a professional until a person clears it.
--
-- The check reads lead_flags from a policy on quote_requests, and lead_flags
-- has its own admin-only policy. A professional evaluating the quote_requests
-- policy would not be allowed to see the flag rows, so "no suspicious flag"
-- would always look true and the lead would leak through. A definer function
-- asks the question on the professional's behalf, without exposing the flags.
-- ---------------------------------------------------------------------------
create or replace function public.quote_request_is_withheld(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.lead_flags f
    where f.quote_request_id = p_id
      and f.status = 'open'
      and f.severity = 'suspicious'
  );
$$;

grant execute on function public.quote_request_is_withheld(uuid) to authenticated;

drop policy if exists "providers see matching leads" on public.quote_requests;
create policy "providers see matching leads" on public.quote_requests for select using (
  (
    exists (
      select 1 from public.providers p
      join public.provider_services s on s.provider_id = p.id
      join public.provider_service_areas a on a.provider_id = p.id
      where p.auth_user_id = (select auth.uid())
        and s.category_slug = quote_requests.category_slug
        and a.city = quote_requests.city
        and p.accepting_work
        and (quote_requests.is_emergency = false or p.accepts_emergency)
    )
    and not public.quote_request_is_withheld(quote_requests.id)
  )
  or claimed_by in (select id from public.providers where auth_user_id = (select auth.uid()))
);
