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

/**
 * Payments run in the `billing` function in Supabase, which holds the Stripe
 * keys. The website only ever sends the signed-in person's own session token.
 */
async function paymentRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const supabase = getSupabase();
  const session = supabase ? (await supabase.auth.getSession()).data.session : null;
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/u, "");
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!base || !anonKey) throw new Error("Payments are not enabled for this application.");
  if (!session?.access_token) throw new Error("Please sign in to manage billing.");

  const headers = new Headers(init?.headers);
  if (init?.body) headers.set("content-type", "application/json");
  headers.set("authorization", `Bearer ${session.access_token}`);
  headers.set("apikey", anonKey);

  const response = await fetch(`${base}/functions/v1/billing/${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
  const value = (await response.json().catch(() => null)) as unknown;
  if (!response.ok || value === null) {
    const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
    const error = record.error && typeof record.error === "object" ? (record.error as Record<string, unknown>) : record;
    if (typeof error.message !== "string") {
      console.error(`[payments] ${init?.method ?? "GET"} ${path} -> HTTP ${response.status}, no message in the reply`);
    }
    throw new Error(typeof error.message === "string" ? error.message : "Payments are temporarily unavailable.");
  }
  const record = typeof value === "object" ? (value as Record<string, unknown>) : {};
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
