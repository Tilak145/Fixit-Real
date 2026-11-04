"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { KeyRound, Mail, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/app/states";
import { useAuth } from "@/lib/auth-context";
import { requireSupabase } from "@/lib/supabase";

/**
 * The management dashboard has its own door. It signs in against the same
 * accounts as the marketplace — there is only one account system — but it is a
 * separate, unlisted screen with no sign-up, and a session only continues if
 * the account actually holds a manager role. A customer account that signs in
 * here is refused and signed straight back out.
 */
// Either dashboard role may sign in: an owner and the staff they added. What
// each may then see is decided inside the dashboard, not at this door.
const MANAGER_ROLES = new Set(["admin", "manager", "owner"]);

/**
 * Who is signed in, read from the accounts service's own answer rather than a
 * second request that a slow network can leave empty. A known account refused
 * by a lookup is the wrong message for a manager whose row simply did not come
 * back in time.
 */
async function signedInUser(): Promise<{ id: string; email: string | null }> {
  const { data, error } = await requireSupabase().auth.getUser();
  if (error) throw new Error("Could not confirm who is signed in. Check your connection and try again.");
  if (!data.user) throw new Error("Sign-in did not complete. Please try again.");
  return { id: data.user.id, email: data.user.email ?? null };
}

async function hasManagerRole(userId: string): Promise<boolean> {
  const { data, error } = await requireSupabase()
    .from("app_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  // A failed read is not a refusal, and asking again is the honest answer.
  if (error) throw new Error("Your access could not be checked just now. Check your connection and try again.");
  return MANAGER_ROLES.has(data?.role ?? "");
}

const NOT_A_MANAGER =
  "This account is not a manager account. Use the customer sign-in for your FixIt account.";

// Signing a refused account out makes the screen fall back to its signed-out
// form, which would erase the explanation. Carry it across that remount so the
// person reads why they were turned away instead of an unchanged form.
let refusalNotice: string | null = null;

function StaffFrame({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-secondary px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-5 flex items-center justify-center gap-2.5 text-white">
          <ShieldCheck className="h-6 w-6 text-accent" aria-hidden="true" />
          <span className="font-display text-[19px] font-semibold">FixIt Management</span>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-accent">Owner</span>
        </div>
        <Card className="border-white/10">
          <CardContent className="gap-1.5 pt-6">
            <h1 className="font-display text-xl font-semibold">{title}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
            <div className="mt-5">{children}</div>
            {footer ? <div className="mt-5 text-center text-[13px] text-muted-foreground">{footer}</div> : null}
          </CardContent>
        </Card>
        <p className="mt-5 text-center text-[12.5px] text-[#9FB0C4]">
          Managers only. Customer accounts sign in on the main site.
        </p>
      </div>
    </main>
  );
}

export function AdminSignIn() {
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [useCode, setUseCode] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(() => {
    const carried = refusalNotice;
    refusalNotice = null;
    return carried;
  });
  const [code, setCode] = useState("");
  const [resending, setResending] = useState(false);
  // A reset that stays inside this door: the owner proves the mailbox with a
  // code and chooses a new password. The emailed reset *link* is a different
  // route, and undeliverable-address rules would refuse it anyway.
  const [resetting, setResetting] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  if (auth.status === "loading") {
    return <LoadingState className="min-h-screen rounded-none border-0" title="Checking sign-in…" />;
  }

  /** Every path ends here: only a manager role reaches the dashboard. */
  const enter = async () => {
    const user = await signedInUser();
    if (!(await hasManagerRole(user.id))) {
      refusalNotice = `${NOT_A_MANAGER} (Signed in as ${user.email ?? "an unknown account"}.)`;
      await requireSupabase().auth.signOut();
      return;
    }
    window.location.replace("/admin");
  };

  const submitCredentials = async (event: FormEvent) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      if (useCode) {
        const result = await auth.requestEmailSignIn(email.trim(), "/admin");
        if (!result.ok) throw new Error(result.message);
        setCodeSent(true);
        return;
      }
      const result = await auth.signIn(email.trim(), password);
      if (!result.ok) throw new Error(result.message);
      await enter();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign-in did not complete. Please try again.");
    } finally {
      setPending(false);
    }
  };

  const submitCode = async (event: FormEvent) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await auth.verifyEmailCode(email.trim(), code.trim());
      if (!result.ok) throw new Error(result.message);
      await enter();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That code was not accepted. Try again.");
    } finally {
      setPending(false);
    }
  };

  const resend = async () => {
    if (resending) return;
    setResending(true);
    setError(null);
    const result = await auth.requestEmailSignIn(email.trim(), "/admin");
    setResending(false);
    if (!result.ok) setError(result.message ?? "The email did not send. Try again.");
  };

  const submitReset = async (event: FormEvent) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await auth.verifyEmailCode(email.trim(), code.trim());
      if (!result.ok) throw new Error(result.message);
      const saved = await auth.updatePassword(newPassword);
      if (!saved.ok) throw new Error(saved.message);
      await enter();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That did not work. Request a new code and try again.");
    } finally {
      setPending(false);
    }
  };

  if (resetting) {
    return (
      <StaffFrame
        title="Set a new password"
        description={`Ask for a code, then enter it with the password you want to use for ${email.trim() || "your account"}.`}
        footer={
          <button type="button" className="font-bold text-primary hover:underline" onClick={() => { setResetting(false); setError(null); }}>
            Back to sign in
          </button>
        }
      >
        <form className="space-y-4" onSubmit={(event) => void submitReset(event)}>
          <div className="space-y-2">
            <Label htmlFor="reset-email">Email</Label>
            <Input
              id="reset-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              disabled={pending}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <Button
            className="w-full"
            variant="outline"
            type="button"
            disabled={pending || !email.includes("@")}
            onClick={async () => {
              setError(null);
              const result = await auth.requestEmailSignIn(email.trim(), "/admin");
              if (!result.ok) setError(result.message ?? "The email did not send. Try again.");
              else setError("Code sent. Enter it below.");
            }}
          >
            Email me a code
          </Button>
          <div className="space-y-2">
            <Label htmlFor="reset-code">Code from the email</Label>
            <Input
              id="reset-code"
              autoComplete="one-time-code"
              inputMode="numeric"
              required
              value={code}
              disabled={pending}
              onChange={(event) => setCode(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reset-password">New password</Label>
            <Input
              id="reset-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={newPassword}
              disabled={pending}
              onChange={(event) => setNewPassword(event.target.value)}
            />
            <p className="text-[12.5px] text-muted-foreground">At least 8 characters.</p>
          </div>
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90" type="submit" disabled={pending}>
            {pending ? "Saving…" : "Set password and sign in"}
          </Button>
        </form>
      </StaffFrame>
    );
  }

  if (codeSent) {
    return (
      <StaffFrame
        title="Enter your code"
        description={`We emailed a sign-in code to ${email.trim()}. It works once.`}
        footer={<button type="button" className="font-bold text-primary hover:underline" onClick={() => setCodeSent(false)}>Use a different account</button>}
      >
        <form className="space-y-4" onSubmit={(event) => void submitCode(event)}>
          <div className="space-y-2">
            <Label htmlFor="staff-code">Email code</Label>
            <Input
              id="staff-code"
              autoFocus
              autoComplete="one-time-code"
              inputMode="numeric"
              required
              value={code}
              disabled={pending}
              onChange={(event) => setCode(event.target.value)}
            />
          </div>
          <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90" type="submit" disabled={pending}>
            {pending ? "Checking…" : "Sign in to management"}
          </Button>
          <Button className="w-full" variant="ghost" type="button" disabled={resending} onClick={() => void resend()}>
            {resending ? "Sending…" : "Resend code"}
          </Button>
        </form>
      </StaffFrame>
    );
  }

  return (
    <StaffFrame
      title="Management sign-in"
      description="The owner's door. Managers sign in here with the account the owner gave them."
      footer={
        <div className="grid gap-2">
          <button type="button" className="font-bold text-primary hover:underline" onClick={() => { setUseCode((value) => !value); setError(null); }}>
            {useCode ? "Use a password instead" : "Email me a sign-in code instead"}
          </button>
          {!useCode ? (
            <button type="button" className="font-semibold text-primary hover:underline" onClick={() => setResetting(true)}>
              Forgot your password?
            </button>
          ) : null}
        </div>
      }
    >
      <form className="space-y-4" onSubmit={(event) => void submitCredentials(event)}>
        <div className="space-y-2">
          <Label htmlFor="staff-email">Email</Label>
          <Input
            id="staff-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            disabled={pending}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        {!useCode && (
          <div className="space-y-2">
            <Label htmlFor="staff-password">Password</Label>
            <Input
              id="staff-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              disabled={pending}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
        )}
        {useCode ? (
          <p className="flex items-start gap-2 text-[13px] text-muted-foreground">
            <Mail className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            We will email a one-time code to this address.
          </p>
        ) : (
          <p className="flex items-start gap-2 text-[13px] text-muted-foreground">
            <KeyRound className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            No account yet? Managers are added by the project owner.
          </p>
        )}
        {error ? (
          <p role="alert" className="text-sm text-destructive">{error}</p>
        ) : null}
        <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90" type="submit" disabled={pending}>
          {pending ? "Working…" : useCode ? "Email me a code" : "Sign in to management"}
        </Button>
      </form>
    </StaffFrame>
  );
}
