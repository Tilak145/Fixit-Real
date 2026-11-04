"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Clock, ShieldCheck, Users } from "lucide-react";

import { FixItLogo } from "@/components/fixit/logo";
import { useAuth } from "@/lib/auth-context";
import { EmailCodeForm } from "@/features/auth/pages";

const inputClass =
  "h-11 w-full rounded-md border border-input bg-input px-3 text-[15px] outline-none ring-ring focus:ring-2";

const PERKS = [
  { icon: Users, title: "Local jobs in your trade", text: "Requests from your city, with photos and a budget." },
  { icon: ShieldCheck, title: "Free for your first 3 months", text: "First 100 pros. Then the plan you choose." },
  { icon: Clock, title: "Set it up in a few minutes", text: "Four fields now. The rest is saved as you go." },
];

/**
 * The four fields every business sign-up asks for, shared by the full page and
 * the window the header opens, so the questions cannot drift apart.
 */
function SignUpFields({
  email,
  setEmail,
  error,
  pending,
  status,
  onSubmit,
}: {
  email: string;
  setEmail: (next: string) => void;
  error: string | null;
  pending: boolean;
  status: string;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <>
      <form onSubmit={onSubmit} className="mt-5 grid gap-3.5" noValidate={false}>
        <label className="block">
          <span className="mb-1 block text-[12.5px] font-bold text-foreground/75">Business name</span>
          <input name="business" required className={inputClass} placeholder="Smith Plumbing LLC" autoComplete="organization" />
        </label>
        <label className="block">
          <span className="mb-1 block text-[12.5px] font-bold text-foreground/75">Your name</span>
          <input name="name" required className={inputClass} placeholder="John Smith" autoComplete="name" />
        </label>
        <label className="block">
          <span className="mb-1 block text-[12.5px] font-bold text-foreground/75">Phone</span>
          <input name="phone" required type="tel" className={inputClass} placeholder="(330) 555-0100" autoComplete="tel" />
        </label>
        <label className="block">
          <span className="mb-1 block text-[12.5px] font-bold text-foreground/75">Email</span>
          <input
            name="email"
            required
            type="email"
            className={inputClass}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@yourbusiness.com"
            autoComplete="email"
          />
          <span className="mt-1 block text-[12px] text-muted-foreground">
            Use an address you check often — we send a short code here, and customers reply to it later.
          </span>
        </label>
        <label className="block">
          <span className="mb-1 block text-[12.5px] font-bold text-foreground/75">Password</span>
          <input
            name="password"
            required
            type="password"
            minLength={8}
            className={inputClass}
            autoComplete="new-password"
            placeholder="At least 8 characters"
          />
        </label>
        {error ? (
          <p role="alert" className="rounded-md border border-[#F6C9C6] bg-[#FDECEC] px-3 py-2 text-[13px] text-[#B3261E]">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending || status === "loading"}
          className="mt-1 flex h-12 w-full items-center justify-center gap-2 rounded-md bg-accent font-display text-[16px] font-semibold text-accent-foreground hover:bg-accent/90 disabled:opacity-60"
        >
          {pending ? "Creating your account…" : "Continue"}
        </button>
      </form>
      <ul className="mt-4 grid gap-1.5">
        {["Free to join, nothing charged today", "Your profile goes live only after review", "Cancel a plan anytime"].map((line) => (
          <li key={line} className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
            <Check className="h-3.5 w-3.5 flex-none text-[#1B7F3B]" aria-hidden="true" />
            {line}
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * A professional's way in. Everything that used to be separate questions is
 * asked once, here: the business name and phone travel with the account and
 * arrive filled in at onboarding, so the wizard only has services, verification
 * and plans left to do.
 */
/**
 * The business sign-up. `compact` fits it into the window the header opens, so
 * a visitor can join without leaving the page they were on; `onJoined` is told
 * once the account exists and its email is confirmed.
 */
export function ProviderSignUpPage() {
  return <ProviderSignUpForm />;
}

export function ProviderSignUpForm({
  compact = false,
  onJoined,
}: { compact?: boolean; onJoined?: () => void } = {}) {
  const { signUp, status } = useAuth();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);
  const [email, setEmail] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    const address = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const business = String(form.get("business") ?? "").trim();
    const name = String(form.get("name") ?? "").trim();
    const phone = String(form.get("phone") ?? "").trim();
    setPending(true);
    setError(null);
    const result = await signUp(
      address,
      password,
      // The account keeps these, so onboarding opens already filled in.
      { fullName: name, phone, address: undefined, city: undefined },
      "/pro/onboarding",
    );
    if (!result.ok) {
      setPending(false);
      setError(result.message ?? "The account could not be created. Check your details and try again.");
      return;
    }
    if (business) {
      try {
        window.sessionStorage.setItem("fixit.pro.businessName", business);
      } catch {
        /* Private browsing refuses storage; onboarding simply asks again. */
      }
    }
    if (result.needsEmailConfirmation) {
      setConfirmationEmail(address);
      setPending(false);
      return;
    }
    onJoined?.();
    router.push("/pro/onboarding");
  }

  if (compact) {
    return confirmationEmail ? (
      <div>
        <EmailCodeForm
          email={confirmationEmail}
          purpose="signup"
          redirectTo="/pro/onboarding"
          title="One last step: confirm your email"
          intro={`We sent a six-digit code to ${confirmationEmail}. Type it here and your business profile opens straight away.`}
          onBack={() => {
            setConfirmationEmail(null);
            setEmail(confirmationEmail);
          }}
        />
      </div>
    ) : (
      <div>
        <span className="inline-flex items-center gap-2 rounded-full bg-[#E9F1FB] px-3 py-1 text-[12px] font-bold text-primary">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          First 100 pros get three months free
        </span>
        <h2 id="join-pro" className="mt-2 font-display text-[22px] font-semibold text-secondary">
          Join FixIt as a pro
        </h2>
        <p className="mt-1 pr-8 text-[13.5px] text-muted-foreground">
          Four fields now, then your services and plan. Nothing is charged today.
        </p>
        <SignUpFields
          email={email}
          setEmail={setEmail}
          error={error}
          pending={pending}
          status={status}
          onSubmit={onSubmit}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <div className="mx-auto max-w-[1120px] px-6 py-6">
        <div className="flex items-center justify-between">
          <FixItLogo />
          <Link href="/login" className="text-[14px] font-bold text-primary hover:underline">
            Log in
          </Link>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1120px] gap-8 px-6 pb-16 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start">
        <div className="pt-4 lg:pt-10">
          <span className="inline-flex items-center gap-2 rounded-full bg-[#E9F1FB] px-3 py-1 text-[12.5px] font-bold text-primary">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            For local professionals in Akron
          </span>
          <h1 className="mt-4 font-display text-[34px] font-semibold leading-[1.15] text-secondary">
            Your next few jobs,
            <br />
            <span className="text-accent">from people down the road.</span>
          </h1>
          <p className="mt-3 max-w-[460px] text-[15px] leading-relaxed text-muted-foreground">
            Join FixIt, get seen by homeowners in your city, and quote only the work you want.
            The first 100 professionals get three months free.
          </p>
          <ul className="mt-6 grid gap-3.5">
            {PERKS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex items-start gap-3">
                <span className="grid h-9 w-9 flex-none place-items-center rounded-lg bg-card text-primary shadow-sm">
                  <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                </span>
                <span>
                  <strong className="block text-[14.5px] text-secondary">{title}</strong>
                  <span className="block text-[13.5px] text-muted-foreground">{text}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-[13px] text-muted-foreground">
            After these four fields, you pick your services, add your licence and choose a plan —
            nothing is charged today.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          {confirmationEmail ? (
            <EmailCodeForm
              email={confirmationEmail}
              purpose="signup"
              redirectTo="/pro/onboarding"
              title="One last step: confirm your email"
              intro={`We sent a six-digit code to ${confirmationEmail}. Type it here and your business profile opens straight away.`}
              onBack={() => {
                setConfirmationEmail(null);
                setEmail(confirmationEmail);
              }}
            />
          ) : (
            <>

              <h2 className="font-display text-[22px] font-semibold text-secondary">Create your business account</h2>
              <p className="mt-1 text-[13.5px] text-muted-foreground">Takes about a minute.</p>
              <SignUpFields
                email={email}
                setEmail={setEmail}
                error={error}
                pending={pending}
                status={status}
                onSubmit={onSubmit}
              />
              <p className="mt-4 text-center text-[13px] text-muted-foreground">
                Already have an account?{" "}
                <Link href="/login" className="font-bold text-primary hover:underline">
                  Log in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
