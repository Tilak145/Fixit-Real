-- Quote comparison: several professionals bid on one job, itemised.
--
-- A homeowner could only ever see one price, because only the professional who
-- claimed a lead could quote it, and a lead has one owner. Comparing prices is
-- the whole point of the request, so that has to change: any professional who
-- matches the request may send a price, and the customer chooses. Claiming
-- becomes what it always meant in the product — this professional is the one
-- doing the job — and it now happens when the customer accepts a quote.
--
-- The price is broken into its parts, and the parts must add up to the total.
-- A single number lets two quotes look comparable when they are not: one is
-- labour only, the other hides a service call and an after-hours surcharge. The
-- check constraint makes a quote whose parts do not sum to its total impossible
-- to store, so the comparison can never show arithmetic that does not hold.

alter table public.quotes
  add column if not exists labour_cents bigint not null default 0 check (labour_cents >= 0),
  add column if not exists materials_cents bigint not null default 0 check (materials_cents >= 0),
  add column if not exists service_call_cents bigint not null default 0 check (service_call_cents >= 0),
  add column if not exists emergency_fee_cents bigint not null default 0 check (emergency_fee_cents >= 0),
  add column if not exists other_cents bigint not null default 0 check (other_cents >= 0),
  add column if not exists other_label text,
  add column if not exists earliest_start date,
  add column if not exists completion_note text,
  add column if not exists warranty text,
  add column if not exists payment_terms text,
  add column if not exists valid_until date;

-- Quotes written before this change carried one number. Recording it as labour
-- keeps every existing quote valid under the new rule, and says nothing untrue:
-- a single figure with no breakdown was, in effect, all labour.
update public.quotes
set labour_cents = amount_cents
where labour_cents = 0
  and materials_cents = 0
  and service_call_cents = 0
  and emergency_fee_cents = 0
  and other_cents = 0;

-- The parts must add up to the total. Enforced here rather than in the form, so
-- no client can store a quote whose breakdown contradicts its own price.
alter table public.quotes drop constraint if exists quotes_parts_sum_to_total;
alter table public.quotes
  add constraint quotes_parts_sum_to_total check (
    amount_cents = labour_cents + materials_cents + service_call_cents + emergency_fee_cents + other_cents
  );

-- Any professional who matches the request may send a price — the services they
-- offer, the area they cover, and only while they are accepting work. The
-- professional already on the job keeps that right whatever they later change.
drop policy if exists quotes_provider_insert on public.quotes;
create policy quotes_provider_insert on public.quotes
  for insert to authenticated
  with check (
    provider_id in (select id from public.providers where auth_user_id = (select auth.uid()))
    and exists (
      select 1
      from public.quote_requests q
      join public.providers p on p.auth_user_id = (select auth.uid())
      join public.provider_services s on s.provider_id = p.id and s.category_slug = q.category_slug
      join public.provider_service_areas a on a.provider_id = p.id and a.city = q.city
      where q.id = quote_request_id
        and (p.accepting_work or q.claimed_by = p.id)
    )
  );

-- Awarding the job. When the customer accepts a price, this professional is the
-- one doing the work, so the request is theirs and every other price on it is
-- closed. Written as a definer function so the customer cannot set claimed_by
-- themselves, and so the losing quotes are declined without the customer
-- touching them.
create or replace function public.quotes_award_on_accept()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Only a fresh acceptance awards the job; re-saving an accepted quote does not.
  if new.status <> 'accepted' or old.status = 'accepted' then
    return new;
  end if;

  -- Hand the request to the professional whose price was accepted.
  update public.quote_requests
  set claimed_by = new.provider_id,
      status = 'claimed'
  where id = new.quote_request_id;

  -- Close every other price on this job, so other professionals stop waiting on
  -- an answer that is not coming.
  update public.quotes
  set status = 'declined',
      responded_at = now()
  where quote_request_id = new.quote_request_id
    and id <> new.id
    and status = 'sent';

  return new;
end;
$$;

drop trigger if exists quotes_award_on_accept on public.quotes;
create trigger quotes_award_on_accept
  after update on public.quotes
  for each row execute function public.quotes_award_on_accept();
