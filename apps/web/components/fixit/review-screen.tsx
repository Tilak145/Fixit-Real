"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { NotificationBell } from "@/components/fixit/notification-bell";
import { SITE_EMAIL } from "@/lib/site-contact";

/**
 * What a professional sees until FixIt approves their business: no dashboard,
 * no leads, just where things stand and what they can still do. It checks again
 * every few seconds, so the dashboard opens by itself once they are approved.
 */
export function ReviewScreen({
  businessName,
  status,
  onSignOut,
}: {
  businessName: string;
  status: string;
  onSignOut: () => void;
}) {
  const queryClient = useQueryClient();
  useEffect(() => {
    const timer = window.setInterval(() => {
      void queryClient.invalidateQueries({ queryKey: ["my-provider"] });
    }, 5_000);
    return () => window.clearInterval(timer);
  }, [queryClient]);

  const rejected = status === "rejected";
  return (
    <div className="min-h-screen bg-background px-4 py-10" data-testid="pro-review-screen">
      <div className="mx-auto max-w-[560px]">
        <div className="mb-3 flex justify-end">
          <NotificationBell home="/pro/dashboard" />
        </div>
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-[12px] font-bold uppercase tracking-wide text-muted-foreground">{businessName}</p>
          <h1 className="mt-2 font-display text-2xl font-semibold">
            {rejected ? "Your business was not approved" : "Your business is in review"}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {rejected
              ? "Your dashboard stays closed. Check your details, or write to us to find out what is needed."
              : "Your dashboard opens once FixIt approves your business. We check your license, insurance and registration, and tell you here and by email."}
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Link
              href="/pro/onboarding"
              className="flex h-12 items-center justify-center rounded-md bg-accent px-6 text-sm font-bold text-accent-foreground hover:bg-accent/90"
            >
              Check or update my details
            </Link>
            <a
              href={`mailto:${SITE_EMAIL}`}
              className="flex h-11 items-center justify-center rounded-md border border-border text-sm font-bold text-foreground/70 hover:border-primary hover:text-primary"
            >
              Contact support
            </a>
            <Link href="/" className="mt-1 text-sm font-bold text-primary hover:underline">
              Back to FixIt home
            </Link>
            <button type="button" onClick={onSignOut} className="text-[13px] text-muted-foreground hover:underline">
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
