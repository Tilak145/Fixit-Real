# Payment

ExaSpark composition guide. `features/plans.tsx` holds the payment building
blocks; the paywall and purchase-success page examples use them.

- `usePlans()` returns the project's Stripe products, the person's ownership,
  the pending price and the last error, and `visit('checkout', priceId)` or
  `visit('portal')`. Call `visit` straight from the press handler so the
  browser can open checkout.
- `Plans` renders every product with a checkout button per price and a
  Manage billing button. `PurchaseStatus` shows whether a purchase is
  confirmed, behind `AccountGate`.
- Only `useOwnership()` entitlements from the server prove a purchase. Never
  unlock from a checkout return URL. Show pending and error states with a
  retry.
