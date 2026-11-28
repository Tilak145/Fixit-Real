-- The owner's view of property accounts: one list with counts, and approval.
-- Only the owner (not other staff) sees it or decides, and nobody at FixIt can
-- open an account's properties, repairs or notes through the tables themselves.

drop policy if exists "org: members read" on public.organizations;
create policy "org: members read" on public.organizations for select to authenticated
  using (public.is_org_member(id));
drop policy if exists "org members: see own organization" on public.organization_members;
create policy "org members: see own organization" on public.organization_members for select to authenticated
  using (public.is_org_member(organization_id));
drop policy if exists "properties: members read" on public.properties;
create policy "properties: members read" on public.properties for select to authenticated
  using (public.is_org_member(organization_id));
drop policy if exists "units: members read" on public.property_units;
create policy "units: members read" on public.property_units for select to authenticated
  using (public.is_org_member(organization_id));
drop policy if exists "repairs: members read" on public.maintenance_requests;
create policy "repairs: members read" on public.maintenance_requests for select to authenticated
  using (public.is_org_member(organization_id));
drop policy if exists "repair history: members read" on public.maintenance_activity;
create policy "repair history: members read" on public.maintenance_activity for select to authenticated
  using (public.is_org_member(organization_id));

create or replace function public.admin_property_accounts()
returns table (
  id uuid, name text, kind text, status text, phone text, owner_email text, created_at timestamptz,
  properties integer, units integer, requests integer, open_requests integer
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not (select public.is_owner()) then
    raise exception 'Only the FixIt owner may see property accounts.';
  end if;
  return query
    select o.id, o.name, o.kind, o.status, o.phone,
      (select u.email::text from public.organization_members m join auth.users u on u.id = m.user_id
        where m.organization_id = o.id and m.role = 'owner' limit 1),
      o.created_at,
      (select count(*)::int from public.properties p where p.organization_id = o.id and p.archived_at is null),
      (select count(*)::int from public.property_units n join public.properties p on p.id = n.property_id
        where n.organization_id = o.id and n.archived_at is null and p.archived_at is null),
      (select count(*)::int from public.maintenance_requests r where r.organization_id = o.id),
      (select count(*)::int from public.maintenance_requests r where r.organization_id = o.id
        and r.status not in ('completed', 'cancelled'))
    from public.organizations o
    order by (o.status = 'pending') desc, o.created_at desc;
end;
$$;
revoke all on function public.admin_property_accounts() from public, anon;
grant execute on function public.admin_property_accounts() to authenticated;

create or replace function public.decide_organization(p_org uuid, p_status text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not (select public.is_owner()) then
    raise exception 'Only the FixIt owner may approve a property account.';
  end if;
  if p_status not in ('approved', 'rejected', 'pending') then
    raise exception 'Unknown decision.';
  end if;
  update public.organizations set status = p_status where id = p_org;
end;
$$;
revoke all on function public.decide_organization(uuid, text) from public, anon;
grant execute on function public.decide_organization(uuid, text) to authenticated;
