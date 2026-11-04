"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { ProviderSignUpForm } from "@/components/fixit/provider-signup";
import { ProSignInForm } from "@/components/fixit/provider-dashboard";

/** Which pro form a window is showing. */
export type ProWindowMode = "join" | "signin" | null;

/**
 * The professional's door inside the page rather than a page of its own.
 *
 * The header's "Join as a Pro" opens this, so joining or signing in never
 * takes a homeowner off the page they were reading: the same form, the same
 * account rules, in a panel over it. Both forms are the ones the whole-page
 * versions use, so there is only ever one place a rule can change.
 */
export function ProWindow({ mode, onClose }: { mode: ProWindowMode; onClose: () => void }) {
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mode) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [mode, onClose]);

  if (!mode) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={mode === "join" ? "Join FixIt as a pro" : "Pro sign in"}
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/55 p-4 sm:p-8"
      onMouseDown={(event) => {
        if (!boxRef.current?.contains(event.target as Node)) onClose();
      }}
    >
      <div
        ref={boxRef}
        className="relative w-full max-w-[520px] rounded-2xl border border-border bg-card p-6 shadow-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>
        {mode === "join" ? (
          <ProviderSignUpForm compact onJoined={onClose} />
        ) : (
          <ProSignInForm onSignedIn={onClose} />
        )}
      </div>
    </div>
  );
}
