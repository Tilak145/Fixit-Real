"use client";

import { useState } from "react";
import { BellRing, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getSupabase } from "@/lib/supabase";

/**
 * The waitlist for a trade with no professional behind it yet. It says plainly
 * that nobody serves the trade in this area today and records an address so the
 * owner can see how much demand there is — it does not pretend to book a visit.
 */
export function ServiceWaitlist({ slug, name }: { slug: string; name: string }) {
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  const join = async (event: React.FormEvent) => {
    event.preventDefault();
    const supabase = getSupabase();
    if (!supabase) {
      setError("The site cannot save this right now. Please try again later.");
      return;
    }
    setState("saving");
    setError(null);
    const { data: auth } = await supabase.auth.getUser();
    const { error: insertError } = await supabase.from("service_waitlist").insert({
      category_slug: slug,
      email: email.trim().toLowerCase(),
      note: note.trim() || null,
      user_id: auth.user?.id ?? null,
    });
    // "Already on the list" is success, not a failure to report.
    if (insertError && insertError.code !== "23505") {
      setState("idle");
      setError("That could not be saved. Check the email address and try again.");
      return;
    }
    setState("done");
  };

  if (state === "done") {
    return (
      <div className="mx-auto max-w-[560px] rounded-xl border border-[#CBE7D3] bg-[#F3FBF5] p-5 text-left">
        <p className="flex items-center gap-2 font-semibold text-[#1B7F3B]">
          <Check className="h-4 w-4" aria-hidden="true" /> You are on the list
        </p>
        <p className="mt-1 text-[13.5px] text-foreground/80">
          We will write to {email.trim()} as soon as a {name.toLowerCase()} professional serves your area. Nothing has been booked.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={(event) => void join(event)} className="mx-auto max-w-[560px] text-left">
      <label className="block">
        <span className="mb-1 block text-[12.5px] font-bold text-foreground/70">Your email</span>
        <input
          type="email"
          required
          value={email}
          disabled={state === "saving"}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          className="h-[42px] w-full rounded-md border border-input bg-input px-3 text-sm outline-none ring-ring focus:ring-2"
        />
      </label>
      <label className="mt-2 block">
        <span className="mb-1 block text-[12.5px] font-bold text-foreground/70">What do you need? (optional)</span>
        <input
          type="text"
          value={note}
          disabled={state === "saving"}
          onChange={(event) => setNote(event.target.value)}
          placeholder={`e.g. gutters cleaned before winter`}
          className="h-[42px] w-full rounded-md border border-input bg-input px-3 text-sm outline-none ring-ring focus:ring-2"
        />
      </label>
      {error ? <p role="alert" className="mt-2 text-[13px] text-destructive">{error}</p> : null}
      <Button type="submit" className="mt-3 w-full" disabled={state === "saving" || !email.includes("@")}>
        <BellRing className="h-4 w-4" aria-hidden="true" /> {state === "saving" ? "Saving…" : `Notify me about ${name.toLowerCase()}`}
      </Button>
      <p className="mt-2 text-[12px] text-muted-foreground">
        We only use this to contact you about {name.toLowerCase()} in your area. It is not a booking and nothing is charged.
      </p>
    </form>
  );
}
