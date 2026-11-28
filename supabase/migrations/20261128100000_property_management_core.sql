-- Property management, Phase 1: organizations (a landlord or a company),
-- their properties and units, and repair records that wrap the existing
-- marketplace job (quote_requests) instead of replacing it.
--
-- Who sees what is decided here, not in the screens: a person sees only the
-- organizations they belong to. In Phase 1 every organization has just its
-- owner; the other roles are accepted by the checks so Phase 3 needs no rewrite.

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('landlord', 'company')),
  name text not null check (length(btrim(name)) between 2 and 120),
  phone text check (phone is null or length(phone) <= 40),
  -- Companies are checked by FixIt before their jobs reach pros; landlords are not.
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'owner'
    check (role in ('owner', 'administrator', 'property_manager', 'coordinator', 'accounting', 'read_only')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index if not exists organization_members_user_idx on public.organization_members (user_id);

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (length(btrim(name)) between 2 and 120),
  kind text not null check (kind in ('residential', 'apartment', 'commercial', 'vacation')),
  address text not null check (length(btrim(address)) between 3 and 300),
  city text not null references public.service_cities (label) on update cascade,
  description text check (description is null or length(description) <= 2000),
  photo_path text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id)
);
create index if not exists properties_org_idx on public.properties (organization_id, archived_at);

create table if not exists public.property_units (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null,
  organization_id uuid not null,
  label text not null check (length(btrim(label)) between 1 and 40),
  notes text check (notes is null or length(notes) <= 1000),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  -- A unit always belongs to the same organization as its property.
  foreign key (property_id, organization_id) references public.properties (id, organization_id) on delete cascade,
  unique (property_id, label),
  unique (id, property_id)
);
create index if not exists property_units_org_idx on public.property_units (organization_id, property_id);

create table if not exists public.maintenance_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  property_id uuid not null,
  unit_id uuid,
  category_slug text not null references public.service_categories (slug),
  title text not null check (length(btrim(title)) between 3 and 150),
  description text not null check (length(btrim(description)) between 5 and 5000),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'submitted' check (status in
    ('submitted', 'awaiting_quotes', 'awaiting_approval', 'assigned', 'scheduled', 'in_progress', 'completed', 'cancelled')),
  preferred_date date,
  availability text check (availability is null or length(availability) <= 500),
  estimated_cost_cents bigint check (estimated_cost_cents is null or estimated_cost_cents >= 0),
  final_cost_cents bigint check (final_cost_cents is null or final_cost_cents >= 0),
  quote_request_id uuid unique references public.quote_requests (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (property_id, organization_id) references public.properties (id, organization_id) on delete cascade,
  -- A unit can only be one of that property's units.
  foreign key (unit_id, property_id) references public.property_units (id, property_id),
  unique (id, organization_id)
);
create index if not exists maintenance_org_idx on public.maintenance_requests (organization_id, status);
create index if not exists maintenance_property_idx on public.maintenance_requests (property_id);

create table if not exists public.maintenance_attachments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  organization_id uuid not null,
  storage_path text not null unique,
  file_name text not null check (length(file_name) <= 200),
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 26214400),
  uploaded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (request_id, organization_id) references public.maintenance_requests (id, organization_id) on delete cascade
);
create index if not exists maintenance_attachments_request_idx on public.maintenance_attachments (request_id);

create table if not exists public.maintenance_notes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  organization_id uuid not null,
  author_id uuid references auth.users (id) on delete set null,
  body text not null check (length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  foreign key (request_id, organization_id) references public.maintenance_requests (id, organization_id) on delete cascade
);
create index if not exists maintenance_notes_request_idx on public.maintenance_notes (request_id);

-- History written only by the database, so nobody can edit it afterwards.
create table if not exists public.maintenance_activity (
  id bigint generated always as identity primary key,
  request_id uuid not null,
  organization_id uuid not null,
  actor_id uuid,
  action text not null,
  detail text,
  created_at timestamptz not null default now(),
  foreign key (request_id, organization_id) references public.maintenance_requests (id, organization_id) on delete cascade
);
create index if not exists maintenance_activity_request_idx on public.maintenance_activity (request_id, created_at);

-- Which organization a marketplace job came from. Only the function below sets it.
alter table public.quote_requests add column if not exists organization_id uuid references public.organizations (id) on delete set null;
-- This table grants reading column by column, so the new one needs its own.
grant select (organization_id) on public.quote_requests to authenticated;

-- ---- Who may do what ------------------------------------------------------

create or replace function public.is_org_member(p_org uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.organization_members m
                 where m.organization_id = p_org and m.user_id = (select auth.uid()));
$$;

create or replace function public.can_manage_org(p_org uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.organization_members m
                 where m.organization_id = p_org and m.user_id = (select auth.uid())
                   and m.role in ('owner', 'administrator', 'property_manager', 'coordinator'));
$$;

revoke all on function public.is_org_member(uuid), public.can_manage_org(uuid) from public;
grant execute on function public.is_org_member(uuid), public.can_manage_org(uuid) to authenticated;

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.properties enable row level security;
alter table public.property_units enable row level security;
alter table public.maintenance_requests enable row level security;
alter table public.maintenance_attachments enable row level security;
alter table public.maintenance_notes enable row level security;
alter table public.maintenance_activity enable row level security;

revoke all on public.organizations, public.organization_members, public.properties, public.property_units,
  public.maintenance_requests, public.maintenance_attachments, public.maintenance_notes, public.maintenance_activity
  from anon, authenticated;

grant select on public.organizations, public.organization_members, public.maintenance_activity to authenticated;
grant update (name, phone) on public.organizations to authenticated;
grant select, insert, update on public.properties, public.property_units to authenticated;
grant select, insert on public.maintenance_requests to authenticated;
-- Status, cost and the marketplace link change only through functions and triggers.
grant update (title, description, priority, preferred_date, availability, category_slug, unit_id, final_cost_cents)
  on public.maintenance_requests to authenticated;
grant select, insert, delete on public.maintenance_attachments to authenticated;
grant select, insert on public.maintenance_notes to authenticated;

create policy "org: members read" on public.organizations for select to authenticated
  using (public.is_org_member(id) or (select public.is_admin()));
create policy "org: managers rename" on public.organizations for update to authenticated
  using (public.can_manage_org(id)) with check (public.can_manage_org(id));
create policy "org members: see own organization" on public.organization_members for select to authenticated
  using (public.is_org_member(organization_id) or (select public.is_admin()));

create policy "properties: members read" on public.properties for select to authenticated
  using (public.is_org_member(organization_id) or (select public.is_admin()));
create policy "properties: managers add" on public.properties for insert to authenticated
  with check (public.can_manage_org(organization_id));
create policy "properties: managers change" on public.properties for update to authenticated
  using (public.can_manage_org(organization_id)) with check (public.can_manage_org(organization_id));

create policy "units: members read" on public.property_units for select to authenticated
  using (public.is_org_member(organization_id) or (select public.is_admin()));
create policy "units: managers add" on public.property_units for insert to authenticated
  with check (public.can_manage_org(organization_id));
create policy "units: managers change" on public.property_units for update to authenticated
  using (public.can_manage_org(organization_id)) with check (public.can_manage_org(organization_id));

create policy "repairs: members read" on public.maintenance_requests for select to authenticated
  using (public.is_org_member(organization_id) or (select public.is_admin()));
create policy "repairs: managers add" on public.maintenance_requests for insert to authenticated
  with check (public.can_manage_org(organization_id) and status = 'submitted' and quote_request_id is null
    and estimated_cost_cents is null and created_by = (select auth.uid()));
create policy "repairs: managers change" on public.maintenance_requests for update to authenticated
  using (public.can_manage_org(organization_id)) with check (public.can_manage_org(organization_id));

create policy "repair files: members read" on public.maintenance_attachments for select to authenticated
  using (public.is_org_member(organization_id));
create policy "repair files: managers add" on public.maintenance_attachments for insert to authenticated
  with check (public.can_manage_org(organization_id) and uploaded_by = (select auth.uid()));
create policy "repair files: managers remove" on public.maintenance_attachments for delete to authenticated
  using (public.can_manage_org(organization_id));

-- Internal notes: the organization only. Never pros, tenants or FixIt staff.
create policy "repair notes: members read" on public.maintenance_notes for select to authenticated
  using (public.is_org_member(organization_id));
create policy "repair notes: managers add" on public.maintenance_notes for insert to authenticated
  with check (public.can_manage_org(organization_id) and author_id = (select auth.uid()));

create policy "repair history: members read" on public.maintenance_activity for select to authenticated
  using (public.is_org_member(organization_id) or (select public.is_admin()));

-- ---- Creating an organization --------------------------------------------

create or replace function public.create_organization(p_kind text, p_name text, p_phone text default null)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_org uuid;
begin
  if v_user is null then
    raise exception 'Sign in first.';
  end if;
  if not exists (select 1 from auth.users u where u.id = v_user and u.email_confirmed_at is not null) then
    raise exception 'Confirm your email address first.';
  end if;
  perform pg_advisory_xact_lock(hashtext('fixit.org.' || v_user::text));
  if exists (select 1 from public.organization_members m where m.user_id = v_user and m.role = 'owner') then
    raise exception 'You already have a property account.';
  end if;
  insert into public.organizations (kind, name, phone, status)
  values (p_kind, btrim(p_name), nullif(btrim(p_phone), ''),
          case when p_kind = 'landlord' then 'approved' else 'pending' end)
  returning id into v_org;
  insert into public.organization_members (organization_id, user_id, role) values (v_org, v_user, 'owner');
  return v_org;
end;
$$;
revoke all on function public.create_organization(text, text, text) from public, anon;
grant execute on function public.create_organization(text, text, text) to authenticated;

-- FixIt owners approve or decline a company.
create or replace function public.decide_organization(p_org uuid, p_status text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not (select public.is_admin()) then
    raise exception 'Only FixIt may approve a company.';
  end if;
  if p_status not in ('approved', 'rejected', 'pending') then
    raise exception 'Unknown decision.';
  end if;
  update public.organizations set status = p_status where id = p_org;
end;
$$;
revoke all on function public.decide_organization(uuid, text) from public, anon;
grant execute on function public.decide_organization(uuid, text) to authenticated;

-- ---- Anti-spam rules and organization jobs --------------------------------

-- A visitor or customer can never label a job as coming from an organization:
-- that label relaxes the spam rules, so only send_to_marketplace may set it.
create or replace function public.quote_requests_guard_organization()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if coalesce(current_setting('fixit.org_send', true), '') <> 'on' then
    if tg_op = 'INSERT' then
      new.organization_id := null;
    elsif new.organization_id is distinct from old.organization_id and new.organization_id is not null then
      new.organization_id := old.organization_id;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.quote_requests_guard_organization() from public, anon, authenticated;
drop trigger if exists quote_requests_a_guard_organization on public.quote_requests;
create trigger quote_requests_a_guard_organization before insert or update on public.quote_requests
  for each row execute function public.quote_requests_guard_organization();

-- Several similar jobs are normal for a property account, so the "sent a moment
-- ago" and "many requests this hour" rules apply only to everyone else. A repair
-- can still only be sent once (maintenance_requests.quote_request_id).
do $$
declare v_fn text; v_new text;
begin
  select pg_get_functiondef('public.screen_quote_request()'::regprocedure) into v_fn;
  if position('organization_id' in v_fn) = 0 then
    v_new := replace(v_fn, 'if v_recent > 0 then', 'if v_recent > 0 and new.organization_id is null then');
    if v_new = v_fn then raise exception 'Could not update the duplicate rule.'; end if;
    execute v_new;
  end if;
  select pg_get_functiondef('public.flag_quote_request()'::regprocedure) into v_fn;
  if position('organization_id' in v_fn) = 0 then
    v_new := replace(v_fn, 'if v_hourly >= 5 then', 'if v_hourly >= 5 and new.organization_id is null then');
    if v_new = v_fn then raise exception 'Could not update the hourly rule.'; end if;
    execute v_new;
  end if;
end $$;

-- ---- Sending a repair to the marketplace ----------------------------------

create or replace function public.send_to_marketplace(p_request uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_repair public.maintenance_requests;
  v_org public.organizations;
  v_property public.properties;
  v_unit text;
  v_email text;
  v_job uuid;
begin
  select * into v_repair from public.maintenance_requests where id = p_request for update;
  if not found or not public.can_manage_org(v_repair.organization_id) then
    raise exception 'That repair is not yours to send.';
  end if;
  if v_repair.quote_request_id is not null then
    raise exception 'This repair has already been sent to professionals.';
  end if;
  if v_repair.status <> 'submitted' then
    raise exception 'This repair can no longer be sent.';
  end if;
  select * into v_org from public.organizations where id = v_repair.organization_id;
  if v_org.status <> 'approved' then
    raise exception 'FixIt is still reviewing your company. You can send jobs once it is approved.';
  end if;
  select * into v_property from public.properties where id = v_repair.property_id;
  select label into v_unit from public.property_units where id = v_repair.unit_id;
  select email into v_email from auth.users where id = v_user;

  perform set_config('fixit.org_send', 'on', true);
  insert into public.quote_requests (
    category_slug, description, customer_name, customer_email, customer_phone, city, customer_address,
    customer_user_id, is_emergency, organization_id
  ) values (
    v_repair.category_slug,
    v_repair.title || E'\n\n' || v_repair.description
      || coalesce(E'\n\nAvailability: ' || nullif(btrim(v_repair.availability), ''), '')
      || coalesce(E'\nPreferred date: ' || to_char(v_repair.preferred_date, 'FMMonth FMDD'), ''),
    v_org.name, v_email, v_org.phone, v_property.city,
    v_property.address || coalesce(', ' || v_unit, ''),
    v_user, v_repair.priority = 'urgent', v_org.id
  ) returning id into v_job;
  perform set_config('fixit.org_send', 'off', true);

  update public.maintenance_requests
  set quote_request_id = v_job, status = 'awaiting_quotes', updated_at = now()
  where id = p_request;
  return v_job;
end;
$$;
revoke all on function public.send_to_marketplace(uuid) from public, anon;
grant execute on function public.send_to_marketplace(uuid) to authenticated;

-- Cancel before a price is accepted; start and finish once a pro is assigned.
create or replace function public.set_repair_status(p_request uuid, p_status text)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_repair public.maintenance_requests;
begin
  select * into v_repair from public.maintenance_requests where id = p_request for update;
  if not found or not public.can_manage_org(v_repair.organization_id) then
    raise exception 'That repair is not yours to change.';
  end if;
  if p_status = 'cancelled' and v_repair.status in ('submitted', 'awaiting_quotes', 'awaiting_approval') then
    -- Close the marketplace job so no more prices arrive.
    if v_repair.quote_request_id is not null then
      update public.quote_requests set status = 'completed' where id = v_repair.quote_request_id;
    end if;
  elsif not (
    (p_status = 'in_progress' and v_repair.status in ('assigned', 'scheduled'))
    or (p_status = 'completed' and v_repair.status in ('assigned', 'scheduled', 'in_progress'))
  ) then
    raise exception 'A repair cannot move from % to %.', v_repair.status, p_status;
  end if;
  update public.maintenance_requests set status = p_status, updated_at = now() where id = p_request;
end;
$$;
revoke all on function public.set_repair_status(uuid, text) from public, anon;
grant execute on function public.set_repair_status(uuid, text) to authenticated;

-- ---- Keeping the repair in step with the marketplace job ------------------

create or replace function public.sync_repair_from_quote()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'accepted' then
    update public.maintenance_requests
    set status = 'assigned', estimated_cost_cents = new.amount_cents, updated_at = now()
    where quote_request_id = new.quote_request_id and status in ('awaiting_quotes', 'awaiting_approval');
  elsif new.status = 'sent' then
    update public.maintenance_requests set status = 'awaiting_approval', updated_at = now()
    where quote_request_id = new.quote_request_id and status = 'awaiting_quotes';
  else
    update public.maintenance_requests set status = 'awaiting_quotes', updated_at = now()
    where quote_request_id = new.quote_request_id and status = 'awaiting_approval'
      and not exists (select 1 from public.quotes q where q.quote_request_id = new.quote_request_id and q.status = 'sent');
  end if;
  return new;
end;
$$;
revoke all on function public.sync_repair_from_quote() from public, anon, authenticated;
drop trigger if exists quotes_sync_repair on public.quotes;
create trigger quotes_sync_repair after insert or update of status on public.quotes
  for each row execute function public.sync_repair_from_quote();

create or replace function public.sync_repair_from_visit()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'scheduled' then
    update public.maintenance_requests set status = 'scheduled', updated_at = now()
    where quote_request_id = new.quote_request_id and status = 'assigned';
  end if;
  return new;
end;
$$;
revoke all on function public.sync_repair_from_visit() from public, anon, authenticated;
drop trigger if exists appointments_sync_repair on public.appointments;
create trigger appointments_sync_repair after insert or update of status on public.appointments
  for each row execute function public.sync_repair_from_visit();

create or replace function public.sync_repair_from_job()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    update public.maintenance_requests set status = 'completed', updated_at = now()
    where quote_request_id = new.id and status in ('assigned', 'scheduled', 'in_progress');
  end if;
  return new;
end;
$$;
revoke all on function public.sync_repair_from_job() from public, anon, authenticated;
drop trigger if exists quote_requests_sync_repair on public.quote_requests;
create trigger quote_requests_sync_repair after update of status on public.quote_requests
  for each row execute function public.sync_repair_from_job();

create or replace function public.record_repair_activity()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_table_name = 'maintenance_notes' then
    insert into public.maintenance_activity (request_id, organization_id, actor_id, action)
    values (new.request_id, new.organization_id, new.author_id, 'note_added');
  elsif tg_op = 'INSERT' then
    insert into public.maintenance_activity (request_id, organization_id, actor_id, action)
    values (new.id, new.organization_id, (select auth.uid()), 'created');
  elsif new.status is distinct from old.status then
    insert into public.maintenance_activity (request_id, organization_id, actor_id, action, detail)
    values (new.id, new.organization_id, (select auth.uid()), 'status', new.status);
  end if;
  return new;
end;
$$;
revoke all on function public.record_repair_activity() from public, anon, authenticated;
drop trigger if exists maintenance_requests_history on public.maintenance_requests;
create trigger maintenance_requests_history after insert or update on public.maintenance_requests
  for each row execute function public.record_repair_activity();
drop trigger if exists maintenance_notes_history on public.maintenance_notes;
create trigger maintenance_notes_history after insert on public.maintenance_notes
  for each row execute function public.record_repair_activity();

-- ---- Private files --------------------------------------------------------
-- Paths start with the organization id: <organization>/<properties|repairs>/...

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('property-files', 'property-files', false, 26214400,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'video/mp4', 'video/quicktime', 'video/webm', 'application/pdf'])
on conflict (id) do nothing;

create or replace function public.property_file_org(p_name text)
returns uuid language sql immutable set search_path = ''
as $$
  select case when split_part(p_name, '/', 1) ~ '^[0-9a-f-]{36}$' then split_part(p_name, '/', 1)::uuid end;
$$;

create policy "property files: members read" on storage.objects for select to authenticated
  using (bucket_id = 'property-files' and public.is_org_member(public.property_file_org(name)));
create policy "property files: managers upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'property-files' and public.can_manage_org(public.property_file_org(name)));
create policy "property files: managers delete" on storage.objects for delete to authenticated
  using (bucket_id = 'property-files' and public.can_manage_org(public.property_file_org(name)));
