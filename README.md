# FixIt website

A local home-services marketplace: the pages, components, styles and images in
`apps/web`, and the database setup and rules in `supabase/`.

The Android phone app is a separate project and is not in this repository.

## Run it on your own computer
1. Install Node.js 22.18 or newer.
2. In `apps/web`, copy `.env.example` to `.env.local` and fill it in.
3. In `apps/web`, run `npm ci`, then `npm run dev`.
4. Open http://localhost:3000.

Without the Supabase settings, pages open but saving shows a "not connected"
message.

Checks, all run from `apps/web`: `npm run typecheck`, `npm test`, `npm run build`.

## Set up the database
1. Create a Supabase project.
2. Apply `supabase/migrations` in order (`supabase db push`).
3. Deploy the functions in `supabase/functions` (`supabase functions deploy`).
4. Set the function secrets (`supabase secrets set`):
   - `APP_URL`: the site's public address
   - `SUPPORT_EMAIL`: the public support address
   - `RESEND_API_KEY`, `MAIL_FROM`, `MAIL_REPLY_TO`: outgoing email
   - `TRIAL_REMINDER_KEY`: any long random value, for scheduled trial reminders
   - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`: see "Payments" below
5. In Supabase Auth, set the Site URL and redirect URLs to the site's address.
6. Sign up on the site with the owner's email, then make that account the owner
   in the Supabase SQL editor, using the real address:

   ```sql
   insert into public.app_roles (user_id, role)
   select id, 'admin' from auth.users where lower(email) = lower('owner@example.com');

   insert into public.protected_owner (user_id)
   select id from auth.users where lower(email) = lower('owner@example.com');
   ```

## Deploy
Any host that runs Next.js can serve it. Use `apps/web` as the project root and
set the variables listed in `apps/web/.env.example`.

## Payments (Stripe)
Pros pay for a plan (Starter $99, Professional $199, Business $399 a month)
through Stripe Checkout. The Stripe keys live only in Supabase; the website holds
none. The code is `supabase/functions/billing`, the tables are in
`20261115063923_stripe_billing.sql`, and the site calls it from `lib/payments.ts`.

1. Create a Stripe account. Start in **test mode** (the toggle in the dashboard).
2. In Supabase > Edge Functions > Secrets, add `STRIPE_SECRET_KEY` (the
   `sk_test_...` key from Stripe > Developers > API keys).
3. In Stripe > Developers > Webhooks, add the endpoint
   `https://<project>.supabase.co/functions/v1/billing/webhook` with the events
   `checkout.session.completed` and `customer.subscription.created`, `.updated`,
   `.deleted`, `.paused`, `.resumed`. Add its signing secret (`whsec_...`) as
   `STRIPE_WEBHOOK_SECRET`.
4. Open a pro's Plan page once: the three plan prices are created in Stripe
   automatically, found again by their lookup keys (`fixit_<plan>_monthly`).
5. Buy a plan with Stripe's test card `4242 4242 4242 4242` (any future date, any
   CVC). The pro's plan should change within a few seconds, and Stripe's webhook
   log should show a 200.
6. To go live, switch Stripe to live mode, replace both secrets with the live
   ones and add the webhook again in live mode. Test and live data are kept
   apart (`livemode`), so nothing from testing is carried over.

Changing a plan's price: edit `supabase/functions/billing/logic.ts` and
`apps/web/features/plans.ts` together (a test checks they agree), then deploy the
function. A new Stripe price is added and takes over the lookup key.

A signed-in pro cannot change their own plan: the database ignores it. The plan
is recorded by the billing function when Stripe confirms a payment, or by staff.

## Not finished
- **What happens when a pro stops paying.** A cancelled or unpaid subscription is
  recorded, but the pro keeps their plan. Decide the rule (for example, pause
  leads, as is done when the free month ends) and add it.
- **Old commission screens.** The database no longer has the commission tables
  (`20261115043645`), but `lib/commission.ts`, `components/fixit/commission-section.tsx`
  and `features/admin/commissions.tsx` still read them and fail quietly.
- **A paid plan picked at sign-up is saved before it is paid for.** The pro's
  profile starts on that plan until staff or the webhook say otherwise.
- **Phone number.** `lib/site-contact.ts` has the real support email, but the
  phone number is still a placeholder.
