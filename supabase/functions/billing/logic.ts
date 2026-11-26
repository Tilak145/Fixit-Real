// The parts of FixIt billing that make decisions, kept free of network and
// Deno calls so Node can test them directly (apps/web/lib/billing-logic.test.ts).
// The `billing` function (index.ts) does the talking to Stripe and the database.

export type PlanKey = "starter" | "professional" | "business";

export interface BillingPlan {
  key: PlanKey;
  name: string;
  description: string;
  /** Monthly price in cents, US dollars. Must match apps/web/features/plans.ts. */
  amountCents: number;
  /** Stripe finds a plan's price by this key, in test mode and live mode alike. */
  lookupKey: string;
}

export const BILLING_PLANS: BillingPlan[] = [
  {
    key: "starter",
    name: "FixIt Starter",
    description: "Unlimited lead access in 1 city, up to 2 services.",
    amountCents: 100,
    lookupKey: "fixit_starter_monthly",
  },
  {
    key: "professional",
    name: "FixIt Professional",
    description: "Search placement above Starter, first look at new leads, up to 5 cities.",
    amountCents: 200,
    lookupKey: "fixit_professional_monthly",
  },
  {
    key: "business",
    name: "FixIt Business",
    description: "Top placement in search, unlimited cities and services, first look at every lead.",
    amountCents: 300,
    lookupKey: "fixit_business_monthly",
  },
];

export function planForLookupKey(lookupKey: string | null | undefined): PlanKey | null {
  return BILLING_PLANS.find((plan) => plan.lookupKey === lookupKey)?.key ?? null;
}

export function planByKey(key: string | null | undefined): BillingPlan | undefined {
  return BILLING_PLANS.find((plan) => plan.key === key);
}

/** Statuses that mean the pro is paying, or inside a paid trial, right now. */
const PLAN_GRANTING = new Set(["active", "trialing"]);
/** Statuses that mean a subscription still exists and must not be duplicated. */
const LIVE = new Set(["active", "trialing", "past_due", "unpaid", "paused", "incomplete"]);

export function grantsPlan(status: string): boolean {
  return PLAN_GRANTING.has(status);
}

export function isLiveSubscription(status: string): boolean {
  return LIVE.has(status);
}

/** The plan a webhook may hand a pro, or null when nothing should change. */
export function planToGrant(status: string, planKey: string | null | undefined): PlanKey | null {
  if (!grantsPlan(status)) return null;
  return planByKey(planKey)?.key ?? null;
}

// ---- Addresses -----------------------------------------------------------

export const ALLOWED_ORIGINS = [
  "https://www.fixitls.com",
  "https://fixitls.com",
  "https://fixit-real.vercel.app",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

const DEFAULT_SITE = "https://www.fixitls.com";

/**
 * Where Stripe sends a customer back to. It is taken from a short list of the
 * site's own addresses, never from the request, so a caller cannot point a
 * checkout at someone else's page.
 */
export function siteBase(requestOrigin: string | null | undefined, appUrl?: string | null): string {
  const configured = (appUrl ?? "").trim().replace(/\/+$/u, "");
  const allowed = configured ? [...ALLOWED_ORIGINS, configured] : ALLOWED_ORIGINS;
  if (requestOrigin && allowed.includes(requestOrigin)) return requestOrigin;
  return configured || DEFAULT_SITE;
}

/** A path on this site, or the fallback. Rejects other hosts, `//`, backslashes and control characters. */
export function safePath(path: unknown, fallback: string): string {
  if (typeof path !== "string") return fallback;
  if (path.length === 0 || path.length > 300) return fallback;
  if (!path.startsWith("/") || path.startsWith("//")) return fallback;
  // eslint-disable-next-line no-control-regex
  if (/[\\\u0000-\u001f\u007f]/u.test(path)) return fallback;
  return path;
}

/** Adds Stripe's session placeholder so the page can ask what happened. Left unencoded on purpose. */
export function withSessionId(url: string): string {
  return url + (url.includes("?") ? "&" : "?") + "session_id={CHECKOUT_SESSION_ID}";
}

// ---- Stripe request bodies ----------------------------------------------

export type FormValue = string | number | boolean | null | undefined | FormValue[] | { [key: string]: FormValue };

/** Stripe takes form-encoded bodies: nested objects as a[b]=1, lists of values as a[]=x, lists of objects as a[0][b]=1. */
export function formEncode(params: { [key: string]: FormValue }): string {
  const parts: string[] = [];
  const walk = (key: string, value: FormValue): void => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        const scalar = item === null || typeof item !== "object";
        walk(scalar ? `${key}[]` : `${key}[${index}]`, item);
      });
    } else if (typeof value === "object") {
      for (const [inner, innerValue] of Object.entries(value)) walk(`${key}[${inner}]`, innerValue);
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
  };
  for (const [key, value] of Object.entries(params)) walk(key, value);
  return parts.join("&");
}

// ---- Free month ----------------------------------------------------------

const HOUR = 3600;

/**
 * Stripe Checkout needs a trial to end at least 48 hours from now. If the pro's
 * free month is still running past that, the subscription starts when it ends,
 * so starting a plan early does not charge them for days they already have.
 * Returns Unix seconds, or undefined when the plan should simply start now.
 */
export function trialEndFor(trialEndsAt: string | null | undefined, nowMs: number): number | undefined {
  if (!trialEndsAt) return undefined;
  const ends = Date.parse(trialEndsAt);
  if (Number.isNaN(ends)) return undefined;
  const seconds = Math.ceil(ends / 1000);
  return seconds >= Math.floor(nowMs / 1000) + 49 * HOUR ? seconds : undefined;
}

// ---- Webhook signature ---------------------------------------------------

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Checks that a webhook really came from Stripe: the `Stripe-Signature` header
 * carries a timestamp and an HMAC of `timestamp.body` made with the endpoint's
 * signing secret. A stale timestamp is refused so a captured request cannot be replayed.
 */
export async function verifyStripeSignature(
  rawBody: string,
  header: string | null | undefined,
  secret: string,
  nowSeconds: number,
  toleranceSeconds = 300,
): Promise<boolean> {
  if (!header || !secret) return false;
  let timestamp = "";
  const signatures: string[] = [];
  for (const piece of header.split(",")) {
    const at = piece.indexOf("=");
    if (at < 0) continue;
    const name = piece.slice(0, at).trim();
    const value = piece.slice(at + 1).trim();
    if (name === "t") timestamp = value;
    else if (name === "v1") signatures.push(value);
  }
  const issued = Number(timestamp);
  if (!timestamp || !Number.isFinite(issued) || signatures.length === 0) return false;
  if (Math.abs(nowSeconds - issued) > toleranceSeconds) return false;
  const expected = await hmacHex(secret, `${timestamp}.${rawBody}`);
  return signatures.some((candidate) => sameText(candidate, expected));
}

// ---- Subscriptions as stored ---------------------------------------------

export interface StripePriceLike {
  id?: string;
  lookup_key?: string | null;
  metadata?: { [key: string]: string } | null;
}

export interface StripeSubscriptionLike {
  id: string;
  customer: string | { id: string };
  status: string;
  cancel_at_period_end?: boolean;
  current_period_end?: number | null;
  trial_end?: number | null;
  metadata?: { [key: string]: string } | null;
  items?: {
    data?: Array<{ current_period_end?: number | null; price?: StripePriceLike | null }>;
  } | null;
}

export interface SubscriptionRecord {
  stripe_subscription_id: string;
  stripe_customer_id: string;
  user_id: string | null;
  status: string;
  plan_key: string | null;
  price_id: string | null;
  cancel_at_period_end: boolean;
  current_period_end: string | null;
  trial_end: string | null;
}

function isoFromUnix(seconds: number | null | undefined): string | null {
  return typeof seconds === "number" && Number.isFinite(seconds) ? new Date(seconds * 1000).toISOString() : null;
}

/**
 * Turns a Stripe subscription into the row we keep. Stripe moved the period end
 * from the subscription onto its items in newer API versions, so both are read.
 */
export function subscriptionRecord(sub: StripeSubscriptionLike): SubscriptionRecord {
  const item = sub.items?.data?.[0];
  const price = item?.price ?? null;
  const planKey = planForLookupKey(price?.lookup_key) ?? planByKey(price?.metadata?.fixit_plan)?.key ?? null;
  return {
    stripe_subscription_id: sub.id,
    stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    user_id: sub.metadata?.supabase_user_id || null,
    status: sub.status,
    plan_key: planKey,
    price_id: price?.id ?? null,
    cancel_at_period_end: Boolean(sub.cancel_at_period_end),
    current_period_end: isoFromUnix(sub.current_period_end ?? item?.current_period_end),
    trial_end: isoFromUnix(sub.trial_end),
  };
}
