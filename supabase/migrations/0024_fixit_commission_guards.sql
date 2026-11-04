-- A commission may only be marked paid with a reference to the payment that
-- settled it. Without this, a mis-click turns "we invoiced them" into "they
-- paid", which is the one claim this product must never make falsely.
--
-- The reference is whatever the provider's payment carries: an invoice number,
-- a transfer reference, a checkout id. The product's own payment runtime has no
-- variable-amount charge endpoint, so the money arrives through another route
-- and this column records which one.

alter table public.commissions
  drop constraint if exists commissions_paid_needs_reference;

alter table public.commissions
  add constraint commissions_paid_needs_reference
  check (
    status <> 'paid'
    or (payment_reference is not null and btrim(payment_reference) <> '')
  );

alter table public.commissions
  drop constraint if exists commissions_paid_has_date;

alter table public.commissions
  add constraint commissions_paid_has_date
  check (status <> 'paid' or paid_at is not null);

-- A dispute is one open question at a time per commission; without this a
-- contractor could file the same dispute repeatedly and flood the queue.
create unique index if not exists commission_disputes_one_open
  on public.commission_disputes (commission_id)
  where status = 'open';
