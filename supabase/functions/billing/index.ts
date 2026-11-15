// Stripe billing for FixIt. The behaviour lives in handler.ts; this file only
// connects it to the real database and reads the function's secrets.
//
// Routes (all under /functions/v1/billing):
//   GET  /products        the three plan prices, created in Stripe on first use
//   POST /checkout        start a plan: returns the Stripe Checkout address
//   POST /portal          open Stripe's page for changing or cancelling a plan
//   GET  /me              the signed-in person's subscriptions
//   GET  /checkouts/:id   what happened to one checkout
//   POST /webhook         called by Stripe, never by the website
//
// Deploy with verify_jwt OFF: Stripe sends no Supabase token, so the webhook is
// proved by its signature, and every other route checks the signed-in person
// itself. Needs 20261115063923_stripe_billing.sql.

import { createClient } from "npm:@supabase/supabase-js@2";
import { createHandler, type Store } from "./handler.ts";

const url = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// A failed database call stops the request, so Stripe tries the webhook again.
// deno-lint-ignore no-explicit-any
function must(result: { data: any; error: { message: string } | null }): any {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

const store: Store = {
  async customerFor(userId, livemode) {
    const row = must(
      await admin
        .from("payment_customers")
        .select("stripe_customer_id")
        .eq("user_id", userId)
        .eq("livemode", livemode)
        .maybeSingle(),
    );
    return (row?.stripe_customer_id as string | undefined) ?? null;
  },
  async saveCustomer(userId, livemode, customerId) {
    must(
      await admin
        .from("payment_customers")
        .upsert({ user_id: userId, livemode, stripe_customer_id: customerId }, { onConflict: "user_id,livemode" }),
    );
  },
  async userForCustomer(customerId, livemode) {
    const row = must(
      await admin
        .from("payment_customers")
        .select("user_id")
        .eq("stripe_customer_id", customerId)
        .eq("livemode", livemode)
        .maybeSingle(),
    );
    return (row?.user_id as string | undefined) ?? null;
  },
  async subscriptionsFor(userId, livemode) {
    const rows = must(
      await admin
        .from("payment_subscriptions")
        .select("stripe_subscription_id,status,plan_key,current_period_end,cancel_at_period_end")
        .eq("user_id", userId)
        .eq("livemode", livemode)
        .order("created_at", { ascending: false }),
    );
    return rows ?? [];
  },
  async saveSubscription(record) {
    must(
      await admin
        .from("payment_subscriptions")
        .upsert({ ...record, updated_at: new Date().toISOString() }, { onConflict: "stripe_subscription_id" }),
    );
  },
  async providerFor(userId) {
    const row = must(
      await admin.from("providers").select("plan,trial_ends_at").eq("auth_user_id", userId).maybeSingle(),
    );
    return row ? { plan: row.plan as string, trial_ends_at: (row.trial_ends_at as string | null) ?? null } : null;
  },
  async setProviderPlan(userId, plan) {
    must(await admin.from("providers").update({ plan }).eq("auth_user_id", userId).neq("plan", plan));
  },
  async eventSeen(eventId) {
    const row = must(await admin.from("payment_events").select("id").eq("id", eventId).maybeSingle());
    return Boolean(row);
  },
  async recordEvent(eventId, type, livemode) {
    must(
      await admin
        .from("payment_events")
        .upsert({ id: eventId, type, livemode }, { onConflict: "id", ignoreDuplicates: true }),
    );
  },
};

const handle = createHandler({
  store,
  env: () => ({
    stripeKey: Deno.env.get("STRIPE_SECRET_KEY") ?? "",
    webhookSecret: Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "",
    appUrl: Deno.env.get("APP_URL") ?? "",
    supabaseUrl: url,
    serviceKey,
  }),
});

Deno.serve(handle);
