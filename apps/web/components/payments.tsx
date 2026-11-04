"use client";

import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import {
  createCheckout,
  createCustomerPortal,
  getMyPaymentState,
  type MyPaymentState,
} from "@/lib/payments";

export function CheckoutButton({
  priceId,
  successPath,
  cancelPath,
  children = "Buy now",
  ...buttonProps
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  priceId: string;
  successPath?: string;
  cancelPath?: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return <div className="grid gap-2">
    <Button
      {...buttonProps}
      disabled={buttonProps.disabled || pending}
      onClick={async (event) => {
        buttonProps.onClick?.(event);
        if (event.defaultPrevented) return;
        setPending(true);
        setError("");
        try {
          const checkout = await createCheckout({ priceId, successPath, cancelPath });
          if (!checkout.checkoutUrl) throw new Error("The Stripe Checkout URL is not ready yet.");
          window.location.assign(checkout.checkoutUrl);
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : String(reason));
          setPending(false);
        }
      }}
    >{pending ? "Opening Stripe…" : children}</Button>
    {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
  </div>;
}

export function BillingPortalButton({
  returnPath,
  children = "Manage subscription",
  ...buttonProps
}: ButtonHTMLAttributes<HTMLButtonElement> & { returnPath?: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return <div className="grid gap-2">
    <Button
      {...buttonProps}
      disabled={buttonProps.disabled || pending}
      onClick={async (event) => {
        buttonProps.onClick?.(event);
        if (event.defaultPrevented) return;
        setPending(true);
        setError("");
        try {
          const portal = await createCustomerPortal({ returnPath });
          window.location.assign(portal.url);
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : String(reason));
          setPending(false);
        }
      }}
    >{pending ? "Opening Stripe…" : children}</Button>
    {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
  </div>;
}

export function SubscriptionGate({
  entitlementKey,
  children,
  fallback = null,
  loading = null,
  errorFallback = null,
}: {
  entitlementKey: string;
  children: ReactNode;
  fallback?: ReactNode;
  loading?: ReactNode;
  errorFallback?: ReactNode;
}) {
  const { status, user } = useAuth();
  const hasAccess = (state: MyPaymentState | undefined) =>
    state?.authenticated && state.userId === user?.id && state.entitlements.some(
      (item) => item.entitlementKey === entitlementKey && item.active,
    );
  const query = useQuery({
    queryKey: ["spk:payments", "me", user?.id, entitlementKey],
    queryFn: getMyPaymentState,
    enabled: status === "authenticated",
    gcTime: 0,
    staleTime: 0,
    retry: 4,
    retryDelay: (attempt) => 500 * 2 ** attempt,
    refetchOnWindowFocus: true,
    refetchInterval: ({ state }) =>
      state.status === "success" && state.data && !hasAccess(state.data) && state.dataUpdateCount < 5
        ? 500 * 2 ** (state.dataUpdateCount - 1)
        : false,
  });
  if (status === "loading") return loading;
  if (status !== "authenticated") return fallback;
  if (query.isPending) return loading;
  if (query.isError) return errorFallback;
  return hasAccess(query.data) ? children : fallback;
}

export function PaymentStatusBadge({ status }: { status: string }) {
  const positive = status === "paid" || status === "active" || status === "trialing";
  return <span className={positive
    ? "inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800"
    : "inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
  }>{status}</span>;
}
