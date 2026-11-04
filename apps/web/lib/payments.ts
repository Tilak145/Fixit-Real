"use client";

import { getSupabase } from "@/lib/supabase";

export interface PaymentPrice {
  id: string;
  stripePriceId: string;
  currency: string;
  unitAmount: number;
  recurringInterval: "day" | "week" | "month" | "year" | null;
  entitlementKey: string | null;
  active: boolean;
}

export interface PaymentProduct {
  id: string;
  stripeProductId: string;
  name: string;
  description: string | null;
  active: boolean;
  prices: PaymentPrice[];
}

export interface CheckoutSession {
  id: string;
  stripeCheckoutSessionId: string | null;
  checkoutMode: "payment" | "subscription";
  status: string;
  paymentStatus: string | null;
  checkoutUrl: string | null;
  expiresAt: string | null;
}

export interface MyPaymentState {
  authenticated: boolean;
  userId?: string;
  subscriptions: Array<{ id: string; status: string }>;
  entitlements: Array<{ entitlementKey: string; active: boolean; expiresAt?: string | null }>;
}

async function paymentRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const supabase = getSupabase();
  const session = supabase ? (await supabase.auth.getSession()).data.session : null;
  const headers = new Headers(init?.headers);
  if (init?.body) headers.set("content-type", "application/json");
  if (session?.access_token) {
    headers.set("x-spk-supabase-access-token", session.access_token);
  }
  const response = await fetch(`/api/spk/payments/${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
  const value = await response.json().catch(() => null) as unknown;
  // A response the payment API did not write carries no JSON message, and the
  // bare fallback erases the one fact that identifies which layer answered:
  // 404/405 from this app's own router when /api/spk/payments is missing or
  // exports one method, 502 from an intermediary, or a 2xx HTML page from the
  // Preview sidecar while the dev server is restarting. The buyer reading the
  // alert cannot act on any of that, so it goes to the console, where
  // spk-browser-check and the Preview log pick it up.
  if (!response.ok || value === null) {
    const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
    const error = record.error && typeof record.error === "object"
      ? record.error as Record<string, unknown>
      : record;
    if (typeof error.message !== "string") {
      console.error(
        `[spk:payments] ${init?.method ?? "GET"} /api/spk/payments/${path} -> HTTP ${response.status}`,
        `${response.headers.get("content-type") ?? "no content-type"}; body was not the payment API's JSON`,
      );
    }
    throw new Error(typeof error.message === "string" ? error.message : "Payments are temporarily unavailable.");
  }
  const record = typeof value === "object" ? value as Record<string, unknown> : {};
  return ("data" in record ? record.data : value) as T;
}

export async function listPaymentProducts(): Promise<PaymentProduct[]> {
  const value = await paymentRequest<{ items: PaymentProduct[] }>("products");
  return value.items;
}

export function createCheckout(input: {
  priceId: string;
  successPath?: string;
  cancelPath?: string;
}): Promise<CheckoutSession> {
  return paymentRequest("checkout", {
    method: "POST",
    headers: { "Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify(input),
  });
}

export async function createCustomerPortal(input: {
  returnPath?: string;
} = {}): Promise<{ url: string }> {
  return paymentRequest("portal", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getMyPaymentState(): Promise<MyPaymentState> {
  return paymentRequest("me");
}

export function getCheckoutResult(sessionId: string): Promise<CheckoutSession> {
  return paymentRequest(`checkouts/${encodeURIComponent(sessionId)}`);
}
