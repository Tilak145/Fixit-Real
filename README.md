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

## Not finished
- **Payments.** `lib/payment-runtime-route.ts` forwards to a payment service that
  belonged to the old platform, and `lib/commission.ts` reads its
  `spk_payment_subscriptions` table, which no migration here creates. Until a
  direct Stripe integration replaces them, checkout reports that payments are
  not enabled.
- **Contact details.** `lib/site-contact.ts` still holds placeholders.
