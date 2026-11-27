-- A business still in review (or turned down) cannot send or change a price.
-- Seeing new leads already required approval; sending a quote did not. This is
-- checked in the database so no screen, app or direct request can get around it.
-- A pro may still withdraw a price they sent earlier.

create or replace function public.quotes_approved_pros_only()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'withdrawn' and exists (
    select 1 from public.providers p
    where p.id = new.provider_id
      and p.auth_user_id = (select auth.uid())
      and p.status is distinct from 'approved'
  ) then
    raise exception 'Your business is still in review. You can send prices once FixIt approves it.';
  end if;
  return new;
end;
$$;

revoke all on function public.quotes_approved_pros_only() from public, anon, authenticated;

drop trigger if exists quotes_a_approved_pros_only on public.quotes;
create trigger quotes_a_approved_pros_only
  before insert or update on public.quotes
  for each row execute function public.quotes_approved_pros_only();
