// FixIt's connection to Stripe: the plan prices, checkout, the billing portal,
// "what do I have?", and the webhook Stripe calls when a payment or a
// subscription changes.
//
// This file does not use any Deno-only API and takes the database and the
// network as arguments, so Node can run it against a pretend Stripe in
// apps/web/lib/billing-handler.test.ts. index.ts wires in the real ones.
//
// Secrets (set in Supabase > Edge Functions > Secrets, never in the website):
//   STRIPE_SECRET_KEY      sk_test_... while testing, sk_live_... when real
//   STRIPE_WEBHOOK_SECRET  whsec_... from the Stripe webhook endpoint
//   APP_URL                optional, the site's public address

import {
  BILLING_PLANS,
  formEncode,
  grantsPlan,
  isLiveSubscription,
  planToGrant,
  safePath,
  siteBase,
  subscriptionRecord,
  trialEndFor,
  verifyStripeSignature,
  withSessionId,
  type BillingPlan,
  type FormValue,
  type StripeSubscriptionLike,
  type SubscriptionRecord,
} from "./logic.ts";

export interface Env {
  stripeKey: string;
  webhookSecret: string;
  appUrl: string;
  supabaseUrl: string;
  serviceKey: string;
}

export interface SubscriptionRow {
  stripe_subscription_id: string;
  status: string;
  plan_key: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

export interface Store {
  customerFor(userId: string, livemode: boolean): Promise<string | null>;
  saveCustomer(userId: string, livemode: boolean, customerId: string): Promise<void>;
  userForCustomer(customerId: string, livemode: boolean): Promise<string | null>;
  subscriptionsFor(userId: string, livemode: boolean): Promise<SubscriptionRow[]>;
  saveSubscription(record: SubscriptionRecord & { user_id: string; livemode: boolean }): Promise<void>;
  providerFor(userId: string): Promise<{ plan: string; trial_ends_at: string | null } | null>;
  setProviderPlan(userId: string, plan: string): Promise<void>;
  eventSeen(eventId: string): Promise<boolean>;
  recordEvent(eventId: string, type: string, livemode: boolean): Promise<void>;
}

export interface Deps {
  env(): Env;
  store: Store;
  fetchFn?: typeof fetch;
  now?(): number;
}

const CORS: { [name: string]: string } = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type, apikey, x-client-info, idempotency-key",
  "access-control-allow-methods": "GET, POST, OPTIONS",
};

function reply(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json", "cache-control": "no-store" },
  });
}
const ok = (data: unknown): Response => reply({ data });
const fail = (status: number, code: string, message: string): Response =>
  reply({ error: { code, message } }, status);

class NotConfigured extends Error {}
class StripeError extends Error {
  status: number;
  stripeCode: string | undefined;
  constructor(status: number, stripeCode: string | undefined, message: string) {
    super(message);
    this.status = status;
    this.stripeCode = stripeCode;
  }
}

interface StripePrice {
  id: string;
  product: string | { id: string };
  unit_amount: number | null;
  currency: string;
  recurring?: { interval: string; interval_count: number } | null;
  lookup_key?: string | null;
}
interface StripeSession {
  id: string;
  mode?: string;
  status?: string | null;
  payment_status?: string | null;
  url?: string | null;
  expires_at?: number | null;
  client_reference_id?: string | null;
  customer?: string | { id: string } | null;
  subscription?: string | { id: string } | null;
}
interface StripeEvent {
  id: string;
  type: string;
  livemode: boolean;
  data: { object: { [key: string]: unknown } };
}
interface User {
  id: string;
  email: string | null;
}

/** Test keys start sk_test_ / rk_test_; anything else is treated as live. */
export function isLiveKey(stripeKey: string): boolean {
  return !/^[sr]k_test_/u.test(stripeKey);
}

const idOf = (value: string | { id: string } | null | undefined): string | null =>
  typeof value === "string" ? value : value?.id ?? null;

function matchesPlan(price: StripePrice, plan: BillingPlan): boolean {
  return (
    price.unit_amount === plan.amountCents &&
    price.currency === "usd" &&
    price.recurring?.interval === "month" &&
    price.recurring?.interval_count === 1
  );
}

function sessionView(session: StripeSession) {
  return {
    id: session.id,
    stripeCheckoutSessionId: session.id,
    checkoutMode: session.mode === "payment" ? "payment" : "subscription",
    status: session.status ?? "open",
    paymentStatus: session.payment_status ?? null,
    checkoutUrl: session.url ?? null,
    expiresAt: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
  };
}

export function createHandler(deps: Deps): (request: Request) => Promise<Response> {
  const { store } = deps;
  const fetchFn = deps.fetchFn ?? fetch;
  const now = deps.now ?? Date.now;

  async function stripe<T>(
    path: string,
    options: { method?: "GET" | "POST"; params?: { [key: string]: FormValue }; idempotencyKey?: string } = {},
  ): Promise<T> {
    const { stripeKey } = deps.env();
    if (!stripeKey) throw new NotConfigured();
    const method = options.method ?? "GET";
    const encoded = options.params ? formEncode(options.params) : "";
    const headers: { [name: string]: string } = { authorization: `Bearer ${stripeKey}` };
    let url = `https://api.stripe.com/v1/${path}`;
    let body: string | undefined;
    if (method === "GET") {
      if (encoded) url += (url.includes("?") ? "&" : "?") + encoded;
    } else {
      body = encoded;
      headers["content-type"] = "application/x-www-form-urlencoded";
      if (options.idempotencyKey) headers["idempotency-key"] = options.idempotencyKey;
    }
    const response = await fetchFn(url, { method, headers, body, signal: AbortSignal.timeout(20_000) });
    const json = (await response.json().catch(() => null)) as
      | { error?: { code?: string; message?: string } }
      | null;
    if (!response.ok) {
      throw new StripeError(response.status, json?.error?.code, json?.error?.message ?? "Stripe request failed");
    }
    return json as T;
  }

  async function currentUser(request: Request): Promise<User | null> {
    const authorization = request.headers.get("authorization") ?? "";
    if (!/^Bearer\s+\S+/iu.test(authorization)) return null;
    const { supabaseUrl, serviceKey } = deps.env();
    const response = await fetchFn(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: serviceKey, authorization },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;
    const user = (await response.json().catch(() => null)) as { id?: unknown; email?: unknown } | null;
    return typeof user?.id === "string" ? { id: user.id, email: typeof user.email === "string" ? user.email : null } : null;
  }

  /**
   * The three plan prices, created in Stripe the first time they are asked for
   * and found again by lookup key after that. Stripe prices cannot be edited, so
   * a changed price in logic.ts adds a new one and moves the key onto it.
   */
  async function ensurePlanPrices(): Promise<Array<{ plan: BillingPlan; price: StripePrice }>> {
    const list = await stripe<{ data: StripePrice[] }>("prices", {
      params: { active: true, limit: 20, lookup_keys: BILLING_PLANS.map((plan) => plan.lookupKey) },
    });
    const result: Array<{ plan: BillingPlan; price: StripePrice }> = [];
    for (const plan of BILLING_PLANS) {
      const stale = list.data.find((price) => price.lookup_key === plan.lookupKey);
      let price = stale && matchesPlan(stale, plan) ? stale : undefined;
      if (!price) {
        const productId = stale
          ? idOf(stale.product)!
          : (
              await stripe<{ id: string }>("products", {
                method: "POST",
                params: { name: plan.name, description: plan.description, metadata: { fixit_plan: plan.key } },
                idempotencyKey: `fixit-product-${plan.key}`,
              })
            ).id;
        price = await stripe<StripePrice>("prices", {
          method: "POST",
          params: {
            product: productId,
            currency: "usd",
            unit_amount: plan.amountCents,
            recurring: { interval: "month" },
            lookup_key: plan.lookupKey,
            transfer_lookup_key: true,
            metadata: { fixit_plan: plan.key },
          },
          idempotencyKey: `fixit-price-${plan.key}-${plan.amountCents}`,
        });
      }
      result.push({ plan, price });
    }
    return result;
  }

  async function customerFor(user: User, livemode: boolean): Promise<string> {
    const known = await store.customerFor(user.id, livemode);
    if (known) return known;
    const customer = await stripe<{ id: string }>("customers", {
      method: "POST",
      params: { email: user.email ?? undefined, metadata: { supabase_user_id: user.id } },
      idempotencyKey: `fixit-customer-${user.id}`,
    });
    await store.saveCustomer(user.id, livemode, customer.id);
    return customer.id;
  }

  async function portalSession(customer: string, returnUrl: string, base: string): Promise<{ url: string }> {
    const make = () =>
      stripe<{ url: string }>("billing_portal/sessions", {
        method: "POST",
        params: { customer, return_url: returnUrl },
      });
    try {
      return await make();
    } catch (error) {
      // A new Stripe account has no portal settings until someone saves them.
      // Create a plain set (invoices, card, cancel at period end) and try once more.
      if (!(error instanceof StripeError) || error.status !== 400 || !/configuration/iu.test(error.message)) throw error;
      await stripe("billing_portal/configurations", {
        method: "POST",
        params: {
          business_profile: {
            headline: "Manage your FixIt plan",
            privacy_policy_url: `${base}/policies/privacy`,
            terms_of_service_url: `${base}/policies/terms`,
          },
          features: {
            invoice_history: { enabled: true },
            payment_method_update: { enabled: true },
            subscription_cancel: { enabled: true, mode: "at_period_end" },
          },
        },
        idempotencyKey: "fixit-portal-configuration-v1",
      });
      return await make();
    }
  }

  async function readJson(request: Request): Promise<{ [key: string]: unknown }> {
    const value = (await request.json().catch(() => null)) as unknown;
    return value && typeof value === "object" && !Array.isArray(value) ? (value as { [key: string]: unknown }) : {};
  }

  // ---- Routes for a signed-in person ------------------------------------

  async function products(): Promise<Response> {
    const rows = await ensurePlanPrices();
    return ok({
      items: rows.map(({ plan, price }) => ({
        id: idOf(price.product),
        stripeProductId: idOf(price.product),
        name: plan.name,
        description: plan.description,
        active: true,
        prices: [
          {
            id: price.id,
            stripePriceId: price.id,
            currency: price.currency,
            unitAmount: price.unit_amount ?? plan.amountCents,
            recurringInterval: "month",
            entitlementKey: plan.key,
            active: true,
          },
        ],
      })),
    });
  }

  async function checkout(request: Request, user: User): Promise<Response> {
    const env = deps.env();
    const body = await readJson(request);
    const priceId = typeof body.priceId === "string" ? body.priceId : "";
    const chosen = (await ensurePlanPrices()).find((row) => row.price.id === priceId);
    if (!chosen) return fail(400, "unknown_plan", "That plan is not available.");

    const livemode = isLiveKey(env.stripeKey);
    const existing = await store.subscriptionsFor(user.id, livemode);
    if (existing.some((row) => isLiveSubscription(row.status))) {
      return fail(409, "already_subscribed", "You already have a plan. Use Manage Plan to change or cancel it.");
    }

    const base = siteBase(request.headers.get("origin"), env.appUrl);
    const provider = await store.providerFor(user.id);
    const customer = await customerFor(user, livemode);
    const label = { supabase_user_id: user.id, fixit_plan: chosen.plan.key };
    const key = request.headers.get("idempotency-key");
    const session = await stripe<StripeSession>("checkout/sessions", {
      method: "POST",
      params: {
        mode: "subscription",
        customer,
        client_reference_id: user.id,
        line_items: [{ price: chosen.price.id, quantity: 1 }],
        success_url: withSessionId(base + safePath(body.successPath, "/pro/dashboard")),
        cancel_url: base + safePath(body.cancelPath, "/pro/dashboard"),
        metadata: label,
        // A free month that is still running carries into the paid plan.
        subscription_data: { metadata: label, trial_end: trialEndFor(provider?.trial_ends_at, now()) },
      },
      idempotencyKey: key ? `fixit-checkout-${user.id}-${key}` : undefined,
    });
    return ok(sessionView(session));
  }

  async function portal(request: Request, user: User): Promise<Response> {
    const env = deps.env();
    const body = await readJson(request);
    const customer = await store.customerFor(user.id, isLiveKey(env.stripeKey));
    if (!customer) return fail(404, "no_billing_account", "You have no billing account yet. Choose a plan first.");
    const base = siteBase(request.headers.get("origin"), env.appUrl);
    const session = await portalSession(customer, base + safePath(body.returnPath, "/pro/dashboard"), base);
    return ok({ url: session.url });
  }

  async function me(user: User): Promise<Response> {
    const { stripeKey } = deps.env();
    const rows = stripeKey ? await store.subscriptionsFor(user.id, isLiveKey(stripeKey)) : [];
    return ok({
      authenticated: true,
      userId: user.id,
      subscriptions: rows
        .filter((row) => isLiveSubscription(row.status))
        .map((row) => ({ id: row.stripe_subscription_id, status: row.status })),
      entitlements: rows
        .filter((row) => row.plan_key && isLiveSubscription(row.status))
        .map((row) => ({
          entitlementKey: row.plan_key as string,
          active: grantsPlan(row.status),
          expiresAt: row.current_period_end,
        })),
    });
  }

  async function checkoutResult(sessionId: string, user: User): Promise<Response> {
    if (!/^cs_[A-Za-z0-9_]+$/u.test(sessionId)) return fail(404, "not_found", "Checkout not found.");
    const session = await stripe<StripeSession>(`checkout/sessions/${sessionId}`);
    // Someone else's checkout looks exactly like one that does not exist.
    if (session.client_reference_id !== user.id) return fail(404, "not_found", "Checkout not found.");
    return ok(sessionView(session));
  }

  // ---- The webhook --------------------------------------------------------

  /** Reads the subscription from Stripe (not from the event, which may be out of date) and saves it. */
  async function syncSubscription(subscriptionId: string, livemode: boolean, userHint?: string | null): Promise<void> {
    const sub = await stripe<StripeSubscriptionLike>(`subscriptions/${subscriptionId}`);
    const record = subscriptionRecord(sub);
    const userId = record.user_id ?? userHint ?? (await store.userForCustomer(record.stripe_customer_id, livemode));
    if (!userId) {
      // Not made through FixIt's checkout (for example by hand in the Stripe dashboard).
      console.error("[billing] subscription without a FixIt user, ignored:", subscriptionId);
      return;
    }
    await store.saveSubscription({ ...record, user_id: userId, livemode });
    const plan = planToGrant(record.status, record.plan_key);
    if (plan) await store.setProviderPlan(userId, plan);
  }

  async function webhook(request: Request): Promise<Response> {
    const { webhookSecret } = deps.env();
    if (!webhookSecret) return fail(503, "payments_not_configured", "Payments are not enabled for this application.");
    const raw = await request.text();
    const valid = await verifyStripeSignature(
      raw,
      request.headers.get("stripe-signature"),
      webhookSecret,
      Math.floor(now() / 1000),
    );
    if (!valid) return fail(400, "bad_signature", "The signature did not match.");

    let event: StripeEvent;
    try {
      event = JSON.parse(raw) as StripeEvent;
    } catch {
      return fail(400, "bad_payload", "The body was not JSON.");
    }
    if (await store.eventSeen(event.id)) return ok({ received: true, duplicate: true });

    const object = event.data?.object ?? {};
    switch (event.type) {
      case "checkout.session.completed": {
        const session = object as unknown as StripeSession;
        const subscriptionId = idOf(session.subscription);
        if (session.mode === "subscription" && subscriptionId) {
          const customerId = idOf(session.customer);
          if (session.client_reference_id && customerId) {
            await store.saveCustomer(session.client_reference_id, event.livemode, customerId);
          }
          await syncSubscription(subscriptionId, event.livemode, session.client_reference_id);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "customer.subscription.paused":
      case "customer.subscription.resumed": {
        const id = typeof object.id === "string" ? object.id : "";
        if (id) await syncSubscription(id, event.livemode);
        break;
      }
      default:
        break;
    }
    await store.recordEvent(event.id, event.type, event.livemode);
    return ok({ received: true });
  }

  // ---- Dispatch -----------------------------------------------------------

  return async function handle(request: Request): Promise<Response> {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    const parts = new URL(request.url).pathname.split("/").filter(Boolean);
    const at = parts.indexOf("billing");
    const route = parts.slice(at + 1);
    try {
      if (route[0] === "webhook" && route.length === 1 && request.method === "POST") return await webhook(request);

      const user = await currentUser(request);
      if (!user) return fail(401, "not_signed_in", "Please sign in again.");

      const method = request.method;
      if (method === "GET" && route[0] === "me" && route.length === 1) return await me(user);
      if (method === "GET" && route[0] === "products" && route.length === 1) return await products();
      if (method === "POST" && route[0] === "checkout" && route.length === 1) return await checkout(request, user);
      if (method === "POST" && route[0] === "portal" && route.length === 1) return await portal(request, user);
      if (method === "GET" && route[0] === "checkouts" && route.length === 2) {
        return await checkoutResult(decodeURIComponent(route[1]), user);
      }
      return fail(404, "not_found", "Payment route not found");
    } catch (error) {
      if (error instanceof NotConfigured) {
        return fail(503, "payments_not_configured", "Payments are not enabled for this application.");
      }
      console.error(
        "[billing]",
        error instanceof StripeError ? `Stripe ${error.status} ${error.stripeCode ?? ""}: ${error.message}` : error,
      );
      return fail(502, "payments_unavailable", "Payments are temporarily unavailable. Please try again.");
    }
  };
}
