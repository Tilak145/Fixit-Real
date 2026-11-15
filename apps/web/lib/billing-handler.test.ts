import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

import { createHandler, isLiveKey, type Env, type Store, type SubscriptionRow } from "../../../supabase/functions/billing/handler.ts";
import type { SubscriptionRecord } from "../../../supabase/functions/billing/logic.ts";

// A pretend Stripe and a pretend database, so the whole billing flow runs
// without a Stripe account. What the real Stripe adds is checked by hand in
// test mode (see the README).

const SUPABASE = "https://proj.supabase.co";
const ENV: Env = {
  stripeKey: "sk_test_fake",
  webhookSecret: "whsec_fake",
  appUrl: "",
  supabaseUrl: SUPABASE,
  serviceKey: "service-role",
};
const NOW = Date.parse("2026-01-01T00:00:00Z");

interface Call {
  method: string;
  path: string;
  form: URLSearchParams;
  headers: { [name: string]: string };
}
interface FakePrice {
  id: string;
  product: string;
  unit_amount: number;
  currency: string;
  recurring: { interval: string; interval_count: number };
  lookup_key: string | null;
  active: boolean;
}

function world(overrides: Partial<Env> = {}) {
  const env: Env = { ...ENV, ...overrides };
  const calls: Call[] = [];
  const prices: FakePrice[] = [];
  const sessions: { [id: string]: { id: string; mode: string; client_reference_id: string; url: string; status: string; payment_status: string } } = {};
  const subscriptions: { [id: string]: { [key: string]: unknown } } = {};
  const tokens: { [token: string]: { id: string; email: string } } = {
    "token-1": { id: "user-1", email: "pro@example.com" },
    "token-2": { id: "user-2", email: "other@example.com" },
  };
  let counter = 0;
  let portalConfigured = false;
  let stripeDown = false;

  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input));
    const headers = Object.fromEntries(Object.entries((init?.headers ?? {}) as { [name: string]: string }));
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

    if (url.href.startsWith(`${SUPABASE}/auth/v1/user`)) {
      const token = (headers.authorization ?? "").replace(/^Bearer\s+/iu, "");
      const user = tokens[token];
      return user ? json(user) : json({ message: "invalid" }, 401);
    }

    assert.equal(url.origin, "https://api.stripe.com", `unexpected request to ${url.href}`);
    const method = init?.method ?? "GET";
    const path = url.pathname.replace(/^\/v1\//u, "");
    const form = new URLSearchParams(typeof init?.body === "string" ? init.body : method === "GET" ? url.search : "");
    calls.push({ method, path, form, headers });
    assert.equal(headers.authorization, `Bearer ${env.stripeKey}`);
    if (stripeDown) return json({ error: { message: "Stripe is down" } }, 500);

    if (method === "GET" && path === "prices") {
      const wanted = url.searchParams.getAll("lookup_keys[]");
      return json({ data: prices.filter((price) => price.active && price.lookup_key && wanted.includes(price.lookup_key)) });
    }
    if (method === "POST" && path === "products") return json({ id: `prod_${(counter += 1)}` });
    if (method === "POST" && path === "prices") {
      const key = form.get("lookup_key");
      if (form.get("transfer_lookup_key") === "true") for (const old of prices) if (old.lookup_key === key) old.lookup_key = null;
      const price: FakePrice = {
        id: `price_${(counter += 1)}`,
        product: form.get("product") ?? "",
        unit_amount: Number(form.get("unit_amount")),
        currency: form.get("currency") ?? "",
        recurring: { interval: form.get("recurring[interval]") ?? "", interval_count: 1 },
        lookup_key: key,
        active: true,
      };
      prices.push(price);
      return json(price);
    }
    if (method === "POST" && path === "customers") return json({ id: `cus_${(counter += 1)}` });
    if (method === "POST" && path === "checkout/sessions") {
      const id = `cs_test_${(counter += 1)}`;
      sessions[id] = {
        id,
        mode: form.get("mode") ?? "",
        client_reference_id: form.get("client_reference_id") ?? "",
        url: `https://checkout.stripe.test/${id}`,
        status: "open",
        payment_status: "unpaid",
      };
      return json(sessions[id]);
    }
    if (method === "GET" && path.startsWith("checkout/sessions/")) {
      const session = sessions[path.slice("checkout/sessions/".length)];
      return session ? json(session) : json({ error: { message: "No such session" } }, 404);
    }
    if (method === "POST" && path === "billing_portal/sessions") {
      if (!portalConfigured) {
        return json(
          { error: { message: "No configuration provided and your test mode default configuration has not been created." } },
          400,
        );
      }
      return json({ url: "https://billing.stripe.test/portal" });
    }
    if (method === "POST" && path === "billing_portal/configurations") {
      portalConfigured = true;
      return json({ id: "bpc_1" });
    }
    if (method === "GET" && path.startsWith("subscriptions/")) {
      const sub = subscriptions[path.slice("subscriptions/".length)];
      return sub ? json(sub) : json({ error: { message: "No such subscription" } }, 404);
    }
    return json({ error: { message: `unhandled ${method} ${path}` } }, 500);
  }) as typeof fetch;

  // The pretend database.
  const customers = new Map<string, string>();
  const rows = new Map<string, SubscriptionRecord & { user_id: string; livemode: boolean }>();
  const providers = new Map<string, { plan: string; trial_ends_at: string | null }>([
    ["user-1", { plan: "founding", trial_ends_at: null }],
  ]);
  const events = new Set<string>();
  const planWrites: Array<[string, string]> = [];

  const store: Store = {
    async customerFor(userId, livemode) {
      return customers.get(`${userId}:${livemode}`) ?? null;
    },
    async saveCustomer(userId, livemode, customerId) {
      customers.set(`${userId}:${livemode}`, customerId);
    },
    async userForCustomer(customerId, livemode) {
      for (const [key, value] of customers) if (value === customerId && key.endsWith(`:${livemode}`)) return key.split(":")[0];
      return null;
    },
    async subscriptionsFor(userId, livemode): Promise<SubscriptionRow[]> {
      return [...rows.values()].filter((row) => row.user_id === userId && row.livemode === livemode);
    },
    async saveSubscription(record) {
      rows.set(record.stripe_subscription_id, record);
    },
    async providerFor(userId) {
      return providers.get(userId) ?? null;
    },
    async setProviderPlan(userId, plan) {
      planWrites.push([userId, plan]);
      const provider = providers.get(userId);
      if (provider) provider.plan = plan;
    },
    async eventSeen(id) {
      return events.has(id);
    },
    async recordEvent(id) {
      events.add(id);
    },
  };

  const handle = createHandler({ env: () => env, store, fetchFn, now: () => NOW });
  const call = (path: string, init: RequestInit & { token?: string } = {}) => {
    const headers = new Headers(init.headers);
    if (init.token) headers.set("authorization", `Bearer ${init.token}`);
    return handle(new Request(`${SUPABASE}/functions/v1/billing/${path}`, { ...init, headers }));
  };
  const data = async (response: Response) => ((await response.json()) as { data?: any; error?: { code: string; message: string } });

  return {
    calls, prices, sessions, subscriptions, customers, rows, providers, events, planWrites, store, call, data,
    setStripeDown(value: boolean) { stripeDown = value; },
    stripeCalls: (path: string, method = "POST") => calls.filter((c) => c.path === path && c.method === method),
  };
}

async function planPriceIds(w: ReturnType<typeof world>): Promise<{ [plan: string]: string }> {
  const response = await w.call("products", { token: "token-1" });
  const body = await w.data(response);
  return Object.fromEntries(body.data.items.map((item: any) => [item.prices[0].entitlementKey, item.prices[0].id]));
}

function post(w: ReturnType<typeof world>, path: string, body: unknown, extra: { [name: string]: string } = {}) {
  return w.call(path, {
    method: "POST",
    token: "token-1",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", ...extra },
  });
}

// ---- Prices ---------------------------------------------------------------

test("the three plans are created in Stripe once and found again after that", async () => {
  const w = world();
  const first = await w.data(await w.call("products", { token: "token-1" }));
  assert.equal(first.data.items.length, 3);
  const byPlan = Object.fromEntries(first.data.items.map((item: any) => [item.prices[0].entitlementKey, item.prices[0]]));
  assert.equal(byPlan.starter.unitAmount, 9900);
  assert.equal(byPlan.professional.unitAmount, 19900);
  assert.equal(byPlan.business.unitAmount, 39900);
  assert.equal(byPlan.starter.recurringInterval, "month");
  assert.equal(byPlan.starter.currency, "usd");
  assert.equal(w.stripeCalls("products").length, 3);
  assert.equal(w.stripeCalls("prices").length, 3);

  const second = await w.data(await w.call("products", { token: "token-1" }));
  assert.deepEqual(second.data.items.map((item: any) => item.prices[0].id), first.data.items.map((item: any) => item.prices[0].id));
  assert.equal(w.stripeCalls("products").length, 3, "no new products");
  assert.equal(w.stripeCalls("prices").length, 3, "no new prices");
});

test("a changed price adds a new Stripe price on the same product and takes over the lookup key", async () => {
  const w = world();
  w.prices.push({
    id: "price_old", product: "prod_old", unit_amount: 4900, currency: "usd",
    recurring: { interval: "month", interval_count: 1 }, lookup_key: "fixit_starter_monthly", active: true,
  });
  const body = await w.data(await w.call("products", { token: "token-1" }));
  const starter = body.data.items.find((item: any) => item.prices[0].entitlementKey === "starter");
  assert.equal(starter.prices[0].unitAmount, 9900);
  assert.notEqual(starter.prices[0].id, "price_old");
  assert.equal(starter.stripeProductId, "prod_old");
  const created = w.stripeCalls("prices").find((c) => c.form.get("lookup_key") === "fixit_starter_monthly");
  assert.equal(created?.form.get("transfer_lookup_key"), "true");
  assert.equal(w.prices.find((p) => p.id === "price_old")?.lookup_key, null);
});

test("price creation can be retried safely", async () => {
  const w = world();
  await planPriceIds(w);
  const keys = w.calls.filter((c) => c.method === "POST").map((c) => c.headers["idempotency-key"]);
  assert.ok(keys.includes("fixit-product-starter"));
  assert.ok(keys.includes("fixit-price-starter-9900"));
});

// ---- Who is asking ---------------------------------------------------------

test("nobody gets in without a signed-in account", async () => {
  const w = world();
  assert.equal((await w.call("products")).status, 401);
  assert.equal((await w.call("products", { token: "anon-key" })).status, 401);
  assert.equal((await w.call("me", { token: "nope" })).status, 401);
  assert.equal((await w.call("checkout", { method: "POST", token: "wrong", body: "{}" })).status, 401);
  assert.equal((await w.call("portal", { method: "POST", body: "{}" })).status, 401);
  assert.equal(w.calls.length, 0, "Stripe is never reached");
});

test("the browser's preflight check is answered", async () => {
  const w = world();
  const response = await w.call("checkout", { method: "OPTIONS" });
  assert.equal(response.status, 204);
  assert.match(response.headers.get("access-control-allow-headers") ?? "", /idempotency-key/u);
});

test("with no Stripe key the site is told payments are off, and /me still answers", async () => {
  const w = world({ stripeKey: "" });
  const off = await w.call("products", { token: "token-1" });
  assert.equal(off.status, 503);
  assert.equal((await w.data(off)).error?.code, "payments_not_configured");
  const me = await w.data(await w.call("me", { token: "token-1" }));
  assert.deepEqual(me.data, { authenticated: true, userId: "user-1", subscriptions: [], entitlements: [] });
});

test("a Stripe outage is reported as unavailable without leaking details", async () => {
  const w = world();
  w.setStripeDown(true);
  const response = await w.call("products", { token: "token-1" });
  assert.equal(response.status, 502);
  const body = await w.data(response);
  assert.equal(body.error?.code, "payments_unavailable");
  assert.ok(!JSON.stringify(body).includes("Stripe is down"));
});

// ---- Checkout --------------------------------------------------------------

test("checkout opens a Stripe subscription for the chosen plan, tied to the signed-in account", async () => {
  const w = world();
  const ids = await planPriceIds(w);
  const response = await post(
    w, "checkout",
    { priceId: ids.professional, successPath: "/pro/dashboard?upgraded=1", cancelPath: "/pro/onboarding" },
    { origin: "https://www.fixitls.com", "idempotency-key": "abc" },
  );
  assert.equal(response.status, 200);
  const view = (await w.data(response)).data;
  assert.match(view.checkoutUrl, /^https:\/\/checkout\.stripe\.test\/cs_test_/u);
  assert.equal(view.checkoutMode, "subscription");

  const sent = w.stripeCalls("checkout/sessions")[0];
  assert.equal(sent.form.get("mode"), "subscription");
  assert.equal(sent.form.get("line_items[0][price]"), ids.professional);
  assert.equal(sent.form.get("line_items[0][quantity]"), "1");
  assert.equal(sent.form.get("client_reference_id"), "user-1");
  assert.equal(sent.form.get("metadata[supabase_user_id]"), "user-1");
  assert.equal(sent.form.get("subscription_data[metadata][fixit_plan]"), "professional");
  assert.equal(sent.form.get("success_url"), "https://www.fixitls.com/pro/dashboard?upgraded=1&session_id={CHECKOUT_SESSION_ID}");
  assert.equal(sent.form.get("cancel_url"), "https://www.fixitls.com/pro/onboarding");
  assert.equal(sent.headers["idempotency-key"], "fixit-checkout-user-1-abc");
  assert.ok(sent.form.get("customer")?.startsWith("cus_"));
  assert.equal(sent.form.get("subscription_data[trial_end]"), null, "no free month to carry over");
  assert.equal(sent.form.get("allow_promotion_codes"), "true", "the payment page offers a promotion code box");
});

test("someone else's address or a price we did not create is refused", async () => {
  const w = world();
  const ids = await planPriceIds(w);

  const evil = await post(
    w, "checkout",
    { priceId: ids.starter, successPath: "https://evil.example/x", cancelPath: "//evil.example" },
    { origin: "https://evil.example" },
  );
  assert.equal(evil.status, 200);
  const sent = w.stripeCalls("checkout/sessions")[0];
  assert.equal(sent.form.get("success_url"), "https://www.fixitls.com/pro/dashboard?session_id={CHECKOUT_SESSION_ID}");
  assert.equal(sent.form.get("cancel_url"), "https://www.fixitls.com/pro/dashboard");

  const w2 = world();
  await planPriceIds(w2);
  const unknown = await post(w2, "checkout", { priceId: "price_someone_elses" });
  assert.equal(unknown.status, 400);
  assert.equal((await w2.data(unknown)).error?.code, "unknown_plan");
  assert.equal(w2.stripeCalls("checkout/sessions").length, 0);
  assert.equal((await post(w2, "checkout", {})).status, 400);
});

test("the same account keeps one Stripe customer", async () => {
  const w = world();
  const ids = await planPriceIds(w);
  await post(w, "checkout", { priceId: ids.starter });
  await post(w, "checkout", { priceId: ids.business });
  assert.equal(w.stripeCalls("customers").length, 1);
  const [a, b] = w.stripeCalls("checkout/sessions");
  assert.equal(a.form.get("customer"), b.form.get("customer"));
});

test("a running free month carries into the paid plan, so nobody pays twice for it", async () => {
  const w = world();
  w.providers.set("user-1", { plan: "founding", trial_ends_at: "2026-01-20T00:00:00Z" });
  const ids = await planPriceIds(w);
  await post(w, "checkout", { priceId: ids.starter });
  assert.equal(w.stripeCalls("checkout/sessions")[0].form.get("subscription_data[trial_end]"), String(Date.parse("2026-01-20T00:00:00Z") / 1000));

  const soon = world();
  soon.providers.set("user-1", { plan: "founding", trial_ends_at: "2026-01-02T00:00:00Z" });
  const soonIds = await planPriceIds(soon);
  await post(soon, "checkout", { priceId: soonIds.starter });
  assert.equal(soon.stripeCalls("checkout/sessions")[0].form.get("subscription_data[trial_end]"), null);
});

test("a second plan cannot be bought on top of a live one, but can after cancelling", async () => {
  const w = world();
  const ids = await planPriceIds(w);
  const row = (status: string): SubscriptionRecord & { user_id: string; livemode: boolean } => ({
    stripe_subscription_id: "sub_1", stripe_customer_id: "cus_1", user_id: "user-1", livemode: false,
    status, plan_key: "starter", price_id: "p", cancel_at_period_end: false, current_period_end: null, trial_end: null,
  });
  for (const status of ["active", "trialing", "past_due"]) {
    w.rows.set("sub_1", row(status));
    const blocked = await post(w, "checkout", { priceId: ids.business });
    assert.equal(blocked.status, 409, status);
    assert.equal((await w.data(blocked)).error?.code, "already_subscribed");
  }
  assert.equal(w.stripeCalls("checkout/sessions").length, 0);
  w.rows.set("sub_1", row("canceled"));
  assert.equal((await post(w, "checkout", { priceId: ids.business })).status, 200);
});

test("a test-mode subscription does not count in live mode", async () => {
  const w = world({ stripeKey: "sk_live_fake" });
  assert.equal(isLiveKey("sk_live_fake"), true);
  assert.equal(isLiveKey("rk_test_fake"), false);
  const ids = await planPriceIds(w);
  w.rows.set("sub_t", {
    stripe_subscription_id: "sub_t", stripe_customer_id: "cus_t", user_id: "user-1", livemode: false,
    status: "active", plan_key: "starter", price_id: "p", cancel_at_period_end: false, current_period_end: null, trial_end: null,
  });
  assert.equal((await post(w, "checkout", { priceId: ids.starter })).status, 200);
  const me = await w.data(await w.call("me", { token: "token-1" }));
  assert.deepEqual(me.data.subscriptions, []);
});

// ---- Portal, /me, checkout result -------------------------------------------

test("the billing portal needs a billing account, and sets itself up on a new Stripe account", async () => {
  const w = world();
  const none = await post(w, "portal", { returnPath: "/pro/dashboard" });
  assert.equal(none.status, 404);
  assert.equal((await w.data(none)).error?.code, "no_billing_account");

  const ids = await planPriceIds(w);
  await post(w, "checkout", { priceId: ids.starter });
  const opened = await post(w, "portal", { returnPath: "/pro/dashboard" }, { origin: "https://www.fixitls.com" });
  assert.equal(opened.status, 200);
  assert.equal((await w.data(opened)).data.url, "https://billing.stripe.test/portal");
  assert.equal(w.stripeCalls("billing_portal/configurations").length, 1);
  const portalCalls = w.stripeCalls("billing_portal/sessions");
  assert.equal(portalCalls[0].form.get("return_url"), "https://www.fixitls.com/pro/dashboard");

  await post(w, "portal", {});
  assert.equal(w.stripeCalls("billing_portal/configurations").length, 1, "set up only once");
});

test("/me lists the live subscriptions and what they unlock", async () => {
  const w = world();
  const add = (id: string, status: string, plan: string | null) =>
    w.rows.set(id, {
      stripe_subscription_id: id, stripe_customer_id: "cus_1", user_id: "user-1", livemode: false,
      status, plan_key: plan, price_id: "p", cancel_at_period_end: false, current_period_end: "2026-02-01T00:00:00.000Z", trial_end: null,
    });
  add("sub_a", "active", "professional");
  add("sub_b", "canceled", "starter");
  add("sub_c", "past_due", "business");
  const me = (await w.data(await w.call("me", { token: "token-1" }))).data;
  assert.deepEqual(me.subscriptions.map((s: any) => s.id).sort(), ["sub_a", "sub_c"]);
  assert.deepEqual(me.entitlements.map((e: any) => [e.entitlementKey, e.active]).sort(), [["business", false], ["professional", true]]);
  const other = (await w.data(await w.call("me", { token: "token-2" }))).data;
  assert.deepEqual(other.subscriptions, []);
});

test("a checkout result is only shown to the account that started it", async () => {
  const w = world();
  const ids = await planPriceIds(w);
  const started = (await w.data(await post(w, "checkout", { priceId: ids.starter }))).data;
  const mine = await w.call(`checkouts/${started.id}`, { token: "token-1" });
  assert.equal(mine.status, 200);
  assert.equal((await w.data(mine)).data.checkoutUrl, started.checkoutUrl);
  assert.equal((await w.call(`checkouts/${started.id}`, { token: "token-2" })).status, 404);
  assert.equal((await w.call("checkouts/not-a-session", { token: "token-1" })).status, 404);
  assert.equal((await w.call("checkouts/cs_test_999", { token: "token-1" })).status, 502, "unknown to Stripe");
});

// ---- Webhook -----------------------------------------------------------------

function signedWebhook(w: ReturnType<typeof world>, event: unknown, options: { secret?: string; age?: number } = {}) {
  const body = JSON.stringify(event);
  const timestamp = Math.floor(NOW / 1000) - (options.age ?? 0);
  const signature = createHmac("sha256", options.secret ?? ENV.webhookSecret).update(`${timestamp}.${body}`).digest("hex");
  return w.call("webhook", { method: "POST", body, headers: { "stripe-signature": `t=${timestamp},v1=${signature}` } });
}

function liveSubscription(status: string, plan = "professional", extra: { [key: string]: unknown } = {}) {
  return {
    id: "sub_1", customer: "cus_1", status, cancel_at_period_end: false,
    metadata: { supabase_user_id: "user-1" },
    current_period_end: Math.floor(NOW / 1000) + 30 * 86400,
    items: { data: [{ price: { id: "price_x", lookup_key: `fixit_${plan}_monthly` } }] },
    ...extra,
  };
}
const completed = (id = "evt_1") => ({
  id, type: "checkout.session.completed", livemode: false,
  data: { object: { id: "cs_test_1", mode: "subscription", subscription: "sub_1", customer: "cus_1", client_reference_id: "user-1" } },
});

test("the webhook refuses anything not signed by Stripe", async () => {
  const w = world();
  w.subscriptions.sub_1 = liveSubscription("active");
  assert.equal((await w.call("webhook", { method: "POST", body: JSON.stringify(completed()) })).status, 400);
  assert.equal((await signedWebhook(w, completed(), { secret: "whsec_other" })).status, 400);
  assert.equal((await signedWebhook(w, completed(), { age: 1000 })).status, 400);
  assert.equal(w.rows.size, 0);
  assert.equal(w.planWrites.length, 0);
  assert.equal(w.calls.length, 0, "nothing was fetched for a forged event");
  assert.equal((await world({ webhookSecret: "" }).call("webhook", { method: "POST", body: "{}" })).status, 503);
});

test("a paid checkout records the subscription and gives the pro their plan", async () => {
  const w = world();
  w.subscriptions.sub_1 = liveSubscription("active", "business");
  const response = await signedWebhook(w, completed());
  assert.equal(response.status, 200);
  const row = w.rows.get("sub_1");
  assert.equal(row?.user_id, "user-1");
  assert.equal(row?.status, "active");
  assert.equal(row?.plan_key, "business");
  assert.equal(row?.livemode, false);
  assert.deepEqual(w.planWrites, [["user-1", "business"]]);
  assert.equal(w.providers.get("user-1")?.plan, "business");
  assert.equal(await w.store.customerFor("user-1", false), "cus_1");
  assert.ok(w.events.has("evt_1"));
});

test("a plan started inside the free month is granted at once", async () => {
  const w = world();
  w.subscriptions.sub_1 = liveSubscription("trialing", "starter");
  await signedWebhook(w, completed());
  assert.equal(w.providers.get("user-1")?.plan, "starter");
});

test("the same event delivered twice is handled once", async () => {
  const w = world();
  w.subscriptions.sub_1 = liveSubscription("active");
  await signedWebhook(w, completed());
  const before = w.calls.length;
  const again = await signedWebhook(w, completed());
  assert.equal(again.status, 200);
  assert.equal((await w.data(again)).data.duplicate, true);
  assert.equal(w.calls.length, before, "no second trip to Stripe");
  assert.equal(w.planWrites.length, 1);
});

test("a cancelled or failing subscription is recorded but never hands out a plan", async () => {
  for (const status of ["canceled", "past_due", "unpaid", "incomplete"]) {
    const w = world();
    w.subscriptions.sub_1 = liveSubscription(status, "business");
    const response = await signedWebhook(w, {
      id: `evt_${status}`, type: "customer.subscription.updated", livemode: false, data: { object: { id: "sub_1" } },
    });
    assert.equal(response.status, 200, status);
    assert.equal(w.rows.get("sub_1")?.status, status);
    assert.equal(w.planWrites.length, 0, status);
    assert.equal(w.providers.get("user-1")?.plan, "founding", status);
  }
});

test("the stored state comes from Stripe, not from the event, so late events cannot go backwards", async () => {
  const w = world();
  w.subscriptions.sub_1 = liveSubscription("active", "professional");
  // An old "created: incomplete" event arrives after the subscription became active.
  await signedWebhook(w, {
    id: "evt_old", type: "customer.subscription.created", livemode: false,
    data: { object: { id: "sub_1", status: "incomplete" } },
  });
  assert.equal(w.rows.get("sub_1")?.status, "active");
});

test("a subscription made by hand in the Stripe dashboard is ignored", async () => {
  const w = world();
  w.subscriptions.sub_9 = { ...liveSubscription("active"), id: "sub_9", customer: "cus_unknown", metadata: {} };
  const response = await signedWebhook(w, {
    id: "evt_9", type: "customer.subscription.created", livemode: false, data: { object: { id: "sub_9" } },
  });
  assert.equal(response.status, 200);
  assert.equal(w.rows.size, 0);
  assert.equal(w.planWrites.length, 0);
});

test("a subscription is matched to its account through the customer when its metadata is missing", async () => {
  const w = world();
  await w.store.saveCustomer("user-1", false, "cus_1");
  w.subscriptions.sub_1 = { ...liveSubscription("active", "starter"), metadata: {} };
  await signedWebhook(w, {
    id: "evt_m", type: "customer.subscription.updated", livemode: false, data: { object: { id: "sub_1" } },
  });
  assert.equal(w.rows.get("sub_1")?.user_id, "user-1");
  assert.equal(w.providers.get("user-1")?.plan, "starter");
});

test("events FixIt does not use are acknowledged and ignored", async () => {
  const w = world();
  const response = await signedWebhook(w, { id: "evt_x", type: "invoice.paid", livemode: false, data: { object: {} } });
  assert.equal(response.status, 200);
  assert.equal(w.calls.length, 0);
  assert.ok(w.events.has("evt_x"));
});

test("when Stripe cannot be reached the webhook fails, so Stripe sends the event again", async () => {
  const w = world();
  w.subscriptions.sub_1 = liveSubscription("active");
  w.setStripeDown(true);
  const failed = await signedWebhook(w, completed());
  assert.equal(failed.status, 502);
  assert.equal(w.events.has("evt_1"), false);
  w.setStripeDown(false);
  const retried = await signedWebhook(w, completed());
  assert.equal(retried.status, 200);
  assert.equal(w.providers.get("user-1")?.plan, "professional");
});

test("a live-mode event is stored as live and never touches a test customer", async () => {
  const w = world({ stripeKey: "sk_live_fake" });
  w.subscriptions.sub_1 = liveSubscription("active", "starter");
  await signedWebhook(w, { ...completed("evt_live"), livemode: true });
  assert.equal(w.rows.get("sub_1")?.livemode, true);
  assert.equal(await w.store.customerFor("user-1", true), "cus_1");
  assert.equal(await w.store.customerFor("user-1", false), null);
});
