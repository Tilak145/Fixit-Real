"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { LoadingState } from "@/components/app/states";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";

/**
 * Shows its children once someone is signed in. Signed-out visitors get a short
 * prompt to sign in or create an account, with the current path preserved so
 * they land back here afterwards.
 */
export function RequireAccount({ children }: { children: ReactNode }) {
  const { status } = useAuth();

  if (status === "loading") return <LoadingState className="mx-auto my-16 w-full max-w-[1280px]" title="Loading your account…" />;

  if (status === "unavailable") {
    return (
      <section className="mx-auto w-full max-w-md flex-1 px-6 py-16 text-center">
        <h1 className="mb-2 font-display text-2xl font-semibold">Accounts are not available</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Account access is not enabled for this site yet. Please try again later.
        </p>
        <Button asChild>
          <Link href="/">Return home</Link>
        </Button>
      </section>
    );
  }

  if (status === "anonymous") {
    return (
      <section className="mx-auto w-full max-w-md flex-1 px-6 py-16">
        <div className="rounded-xl border border-border bg-card p-8 text-center shadow-sm">
          <h1 className="mb-2 font-display text-2xl font-semibold">Sign in to see your requests</h1>
          <p className="mb-6 text-sm text-muted-foreground">
            Use the email you requested quotes with. We will send you a one-time code — no password needed.
          </p>
          <div className="flex flex-col gap-2">
            <Button asChild className="w-full">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/register">Create an account</Link>
            </Button>
          </div>
        </div>
      </section>
    );
  }

  return <>{children}</>;
}
