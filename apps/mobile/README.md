# FixIt mobile app

The customer app for FixIt (Expo and React Native), using the same Supabase
project as the website.

## Set up

1. `cp .env.example .env` and fill it in. It holds only public values: the
   Supabase address, its public (anon) key and the website address.
2. `npm ci`
3. `npm run dev` runs the app in a browser. `npm run typecheck` and `npm test`
   check the code.

## Identity

- Name: FixIt. Android package: `com.fixitls.app`. Link scheme: `fixit`.
- Sign-in emails bring people back with `fixit://auth/callback`. That address
  must be listed under Redirect URLs in Supabase (Authentication, URL
  Configuration), next to the website's.

## Payments

Plans are paid through the website's `billing` function in Supabase, which holds
the Stripe keys. The app never holds a payment secret. Checkout opens Stripe's
own page in the phone's browser and returns to the website.

The template's component guides are in `docs/` (ExaSpark's starter kit).
