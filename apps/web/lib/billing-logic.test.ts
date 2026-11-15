import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

import {
  BILLING_PLANS,
  formEncode,
  grantsPlan,
  isLiveSubscription,
  planForLookupKey,
  planToGrant,
  safePath,
  siteBase,
  subscriptionRecord,
  trialEndFor,
  verifyStripeSignature,
  withSessionId,
} from "../../../supabase/functions/billing/logic.ts";
import { PAID_PLANS } from "../features/plans.ts";

test("the prices Stripe will charge are the prices the site shows", () => {
  assert.equal(BILLING_PLANS.length, PAID_PLANS.length);
  for (const shown of PAID_PLANS) {
    const billed = BILLING_PLANS.find((plan) => plan.key === shown.key);
    assert.ok(billed, `no billing plan for ${shown.key}`);
    assert.equal(billed.amountCents, shown.price * 100, `${shown.key} price differs`);
  }
});

test("each plan has its own lookup key and is found again by it", () => {
  const keys = new Set(BILLING_PLANS.map((plan) => plan.lookupKey));
  assert.equal(keys.size, BILLING_PLANS.length);
  for (const plan of BILLING_PLANS) assert.equal(planForLookupKey(plan.lookupKey), plan.key);
  assert.equal(planForLookupKey("something_else"), null);
  assert.equal(planForLookupKey(null), null);
});

test("only a paying or trialling subscription hands out a plan", () => {
  assert.equal(planToGrant("active", "business"), "business");
  assert.equal(planToGrant("trialing", "starter"), "starter");
  for (const status of ["past_due", "canceled", "unpaid", "incomplete", "incomplete_expired", "paused"]) {
    assert.equal(planToGrant(status, "business"), null, status);
  }
  assert.equal(planToGrant("active", "founding"), null);
  assert.equal(planToGrant("active", null), null);
  assert.equal(grantsPlan("active"), true);
  assert.equal(grantsPlan("past_due"), false);
});

test("a second checkout is blocked while a subscription is still alive", () => {
  for (const status of ["active", "trialing", "past_due", "unpaid", "paused", "incomplete"]) {
    assert.equal(isLiveSubscription(status), true, status);
  }
  assert.equal(isLiveSubscription("canceled"), false);
  assert.equal(isLiveSubscription("incomplete_expired"), false);
});

test("form bodies are nested the way Stripe reads them", () => {
  const body = formEncode({
    mode: "subscription",
    line_items: [{ price: "price_1", quantity: 1 }],
    subscription_data: { metadata: { supabase_user_id: "u1" } },
    lookup_keys: ["a", "b"],
    skipped: undefined,
    empty: null,
  });
  const decoded = decodeURIComponent(body);
  assert.match(decoded, /mode=subscription/);
  assert.match(decoded, /line_items\[0\]\[price\]=price_1/);
  assert.match(decoded, /line_items\[0\]\[quantity\]=1/);
  assert.match(decoded, /subscription_data\[metadata\]\[supabase_user_id\]=u1/);
  assert.match(decoded, /lookup_keys\[\]=a&lookup_keys\[\]=b/);
  assert.ok(!decoded.includes("skipped") && !decoded.includes("empty"));
});

test("characters that could break a form body are escaped", () => {
  const body = formEncode({ email: "a&b=c d@example.com" });
  assert.equal(body, "email=a%26b%3Dc%20d%40example.com");
});

test("return paths stay on this site", () => {
  assert.equal(safePath("/pro/dashboard?upgraded=1", "/x"), "/pro/dashboard?upgraded=1");
  for (const bad of ["https://evil.example/", "//evil.example", "evil", "/a\\b", "/a\nb", "", undefined, 5, "/" + "a".repeat(400)]) {
    assert.equal(safePath(bad, "/x"), "/x", String(bad));
  }
});

test("Stripe sends people back to one of the site's own addresses", () => {
  assert.equal(siteBase("https://www.fixitls.com"), "https://www.fixitls.com");
  assert.equal(siteBase("http://localhost:3000"), "http://localhost:3000");
  assert.equal(siteBase("https://evil.example"), "https://www.fixitls.com");
  assert.equal(siteBase(null), "https://www.fixitls.com");
  assert.equal(siteBase("https://evil.example", "https://shop.example/"), "https://shop.example");
  assert.equal(siteBase("https://shop.example", "https://shop.example"), "https://shop.example");
});

test("the session placeholder is added once and left unencoded", () => {
  assert.equal(withSessionId("https://x.test/a"), "https://x.test/a?session_id={CHECKOUT_SESSION_ID}");
  assert.equal(withSessionId("https://x.test/a?b=1"), "https://x.test/a?b=1&session_id={CHECKOUT_SESSION_ID}");
});

test("a running free month carries over into the paid plan", () => {
  const now = Date.parse("2026-01-01T00:00:00Z");
  assert.equal(trialEndFor("2026-01-20T00:00:00Z", now), Date.parse("2026-01-20T00:00:00Z") / 1000);
  // Under 48 hours left: Stripe would refuse it, so the plan starts now.
  assert.equal(trialEndFor("2026-01-02T12:00:00Z", now), undefined);
  assert.equal(trialEndFor("2025-12-01T00:00:00Z", now), undefined);
  assert.equal(trialEndFor(null, now), undefined);
  assert.equal(trialEndFor("not a date", now), undefined);
});

const SECRET = "whsec_test_secret";
const BODY = JSON.stringify({ id: "evt_1", type: "customer.subscription.updated" });
function sign(timestamp: number, body = BODY, secret = SECRET): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

test("a genuine Stripe signature is accepted", async () => {
  const now = 1_800_000_000;
  assert.equal(await verifyStripeSignature(BODY, `t=${now},v1=${sign(now)}`, SECRET, now), true);
  // Stripe may send several v1 values while a secret is being rolled.
  assert.equal(await verifyStripeSignature(BODY, `t=${now},v1=deadbeef,v1=${sign(now)}`, SECRET, now), true);
});

test("a forged, altered, stale or missing signature is refused", async () => {
  const now = 1_800_000_000;
  assert.equal(await verifyStripeSignature(BODY, `t=${now},v1=${sign(now, BODY, "whsec_other")}`, SECRET, now), false);
  assert.equal(await verifyStripeSignature(BODY + " ", `t=${now},v1=${sign(now)}`, SECRET, now), false);
  assert.equal(await verifyStripeSignature(BODY, `t=${now - 301},v1=${sign(now - 301)}`, SECRET, now), false);
  assert.equal(await verifyStripeSignature(BODY, `t=${now + 301},v1=${sign(now + 301)}`, SECRET, now), false);
  assert.equal(await verifyStripeSignature(BODY, `t=${now}`, SECRET, now), false);
  assert.equal(await verifyStripeSignature(BODY, `v1=${sign(now)}`, SECRET, now), false);
  assert.equal(await verifyStripeSignature(BODY, null, SECRET, now), false);
  assert.equal(await verifyStripeSignature(BODY, `t=${now},v1=${sign(now)}`, "", now), false);
  assert.equal(await verifyStripeSignature(BODY, "garbage", SECRET, now), false);
});

test("a subscription is stored with its plan, status and dates", () => {
  const record = subscriptionRecord({
    id: "sub_1",
    customer: "cus_1",
    status: "trialing",
    cancel_at_period_end: false,
    current_period_end: 1_800_000_000,
    trial_end: 1_800_000_000,
    metadata: { supabase_user_id: "user-1" },
    items: { data: [{ price: { id: "price_1", lookup_key: "fixit_professional_monthly" } }] },
  });
  assert.equal(record.plan_key, "professional");
  assert.equal(record.user_id, "user-1");
  assert.equal(record.stripe_customer_id, "cus_1");
  assert.equal(record.price_id, "price_1");
  assert.equal(record.status, "trialing");
  assert.equal(record.current_period_end, "2027-01-15T08:00:00.000Z");
  assert.equal(record.trial_end, "2027-01-15T08:00:00.000Z");
});

test("the period end is read from the item when the subscription no longer carries it", () => {
  const record = subscriptionRecord({
    id: "sub_2",
    customer: { id: "cus_2" },
    status: "active",
    items: { data: [{ current_period_end: 1_800_000_000, price: { metadata: { fixit_plan: "business" } } }] },
  });
  assert.equal(record.stripe_customer_id, "cus_2");
  assert.equal(record.plan_key, "business");
  assert.equal(record.current_period_end, "2027-01-15T08:00:00.000Z");
  assert.equal(record.user_id, null);
  assert.equal(record.trial_end, null);
});

test("a price that is not one of ours gives no plan", () => {
  const record = subscriptionRecord({
    id: "sub_3",
    customer: "cus_3",
    status: "active",
    items: { data: [{ price: { id: "price_other", lookup_key: "someone_elses" } }] },
  });
  assert.equal(record.plan_key, null);
  assert.equal(planToGrant(record.status, record.plan_key), null);
});
