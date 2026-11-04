"use client";

import { useEffect, useReducer, useRef, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/app/states";
import { emailCodeAdvice, useAuth } from "@/lib/auth-context";
import { AddressInput } from "@/components/fixit/address-input";

function AuthFrame({
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
    <main className="grid min-h-screen place-items-center bg-muted/40 px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          {children}
          {footer ? <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div> : null}
        </CardContent>
      </Card>
    </main>
  );
}

function UnavailableAuth() {
  return (
    <AuthFrame title="Sign-in is unavailable" description="Account access is not enabled for this application.">
      <Button asChild className="w-full"><a href="/">Return home</a></Button>
    </AuthFrame>
  );
}

function LoadingAuth() {
  return <LoadingState className="min-h-screen rounded-none border-0" title="Loading your account…" />;
}

type EmailCodeState = { code: string; pending: "verify" | "resend" | null; message: string | null };
type EmailCodeEvent = { type: "code"; value: string } | { type: "start"; action: "verify" | "resend" } | { type: "error"; message: string; clear?: boolean } | { type: "sent" };

export function emailCodeReducer(state: EmailCodeState, event: EmailCodeEvent): EmailCodeState {
  switch (event.type) {
    case "code": return { ...state, code: event.value };
    case "start": return { ...state, pending: event.action, message: null };
    case "error": return { ...state, code: event.clear ? "" : state.code, pending: null, message: event.message };
    case "sent": return { code: "", pending: null, message: "If your account can receive this email, a new message is on its way. Use the most recent code or link." };
  }
}

export function EmailCodeForm({ email, purpose, onBack, redirectTo = "/", title, intro }: { email: string; purpose: "signup" | "login"; onBack(): void; redirectTo?: string; title?: string; intro?: string }) {
  const auth = useAuth();
  const [state, dispatch] = useReducer(emailCodeReducer, { code: "", pending: null, message: null });
  const sentRef = useRef(false);
  const verify = async (event: FormEvent) => {
    event.preventDefault();
    if (state.pending) return;
    dispatch({ type: "start", action: "verify" });
    const result = await auth.verifyEmailCode(email, state.code);
    // A refused code is cleared, so retyping it fires the check again.
    if (!result.ok) return dispatch({ type: "error", message: result.message ?? "Please try again.", clear: true });
    window.location.replace(redirectTo);
  };
  const resend = async () => {
    if (state.pending) return;
    dispatch({ type: "start", action: "resend" });
    const result = await (purpose === "signup" ? auth.resendEmailConfirmation(email) : auth.requestEmailSignIn(email, redirectTo));
    dispatch(result.ok ? { type: "sent" } : { type: "error", message: result.message ?? "Please try again." });
  };
  // The code is six digits, so the sixth digit is the moment to check it:
  // nobody has to press a button they are already waiting on. A wrong code
  // simply sends them back to the field to retype it. A fresh code is only
  // checked on the next sixth digit, never twice for the same one.
  const complete = state.code.length === 6;
  const verifyRef = useRef(verify);
  verifyRef.current = verify;
  useEffect(() => {
    if (!complete || state.pending) return;
    void verifyRef.current(new Event("submit") as unknown as FormEvent);
    // Only the moment the code becomes complete matters; retyping a new code
    // sets "complete" false again and then true, which fires this once more.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complete]);
  return (
    <AuthFrame title={title ?? (purpose === "signup" ? "Confirm your email" : "Check your email")} description={intro ?? (purpose === "signup"
      ? `Enter the code we emailed to ${email}, or follow the link in that email.`
      : `Enter the code sent to ${email}, or follow the link in the email.`)}>
      <form className="space-y-4" onSubmit={(event) => void verify(event)}>
        <div className="space-y-2">
          <Label htmlFor="email-code">Email code</Label>
          <Input
            id="email-code"
            autoFocus
            autoComplete="one-time-code"
            inputMode="numeric"
            maxLength={6}
            className="text-center font-mono text-xl tracking-[0.4em]"
            required
            value={state.code}
            disabled={!!state.pending}
            onChange={(event) => dispatch({ type: "code", value: event.target.value.replace(/\D/g, "").slice(0, 6) })}
          />
        </div>
        {state.message ? (
          <p role="status" className="text-sm text-muted-foreground">{state.message}</p>
        ) : purpose === "signup" ? (
          <p className="text-sm text-muted-foreground">{emailCodeAdvice(email)}</p>
        ) : null}
        <Button className="w-full" type="submit" disabled={!!state.pending || !complete}>
          {state.pending === "verify" ? "Checking the code…" : "Verify and continue"}
        </Button>
        <Button className="h-11 w-full" variant="outline" type="button" disabled={!!state.pending} onClick={() => void resend()}>
          {state.pending === "resend" ? "Sending…" : "Send a new code"}
        </Button>
        <Button className="h-11 w-full" variant="ghost" type="button" disabled={!!state.pending} onClick={onBack}>
          Use another email
        </Button>
      </form>
      {state.pending === "verify" ? <span className="sr-only" role="status">Checking your code</span> : null}
    </AuthFrame>
  );
}

export function LoginPage({ allowEmailOtp = false, defaultEmailOtp = false, redirectTo = "/" }: { allowEmailOtp?: boolean; defaultEmailOtp?: boolean; redirectTo?: string } = {}) {
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [emailOnly, setEmailOnly] = useState(defaultEmailOtp);
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null);
  if (auth.status === "loading") return <LoadingAuth />;
  if (auth.status === "unavailable") return <UnavailableAuth />;
  if (verificationEmail) return <EmailCodeForm email={verificationEmail} purpose="login" redirectTo={redirectTo} onBack={() => setVerificationEmail(null)} />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    const result = await (emailOnly ? auth.requestEmailSignIn(email.trim(), redirectTo) : auth.signIn(email.trim(), password));
    setPending(false);
    if (!result.ok) return toast.error(result.message);
    if (emailOnly) { setVerificationEmail(email.trim()); return; }
    window.location.replace(redirectTo);
  };

  return (
    <AuthFrame
      title="Welcome back"
      description="Continue with your account."
      footer={<>Need an account? <a className="text-primary underline-offset-4 hover:underline" href="/register">Create one</a></>}
    >
      <form className="space-y-4" onSubmit={(event) => void submit(event)}>
        <div className="space-y-2">
          <Label htmlFor="login-email">Email</Label>
          <Input id="login-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
        </div>
        {!emailOnly && <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="login-password">Password</Label>
            <a className="text-sm text-primary hover:underline" href="/forgot-password">Forgot password?</a>
          </div>
          <Input id="login-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
        </div>}
        <Button className="w-full" type="submit" disabled={pending}>{pending ? "Please wait…" : emailOnly ? "Send sign-in email" : "Sign in"}</Button>
        {allowEmailOtp && <Button className="w-full" type="button" variant="ghost" disabled={pending} onClick={() => { setEmailOnly(!emailOnly); setPassword(""); }}>{emailOnly ? "Use a password" : "Sign in with an email code"}</Button>}
      </form>
    </AuthFrame>
  );
}

export function RegisterPage() {
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [pending, setPending] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null);
  if (auth.status === "loading") return <LoadingAuth />;
  if (auth.status === "unavailable") return <UnavailableAuth />;
  if (verificationEmail) return <EmailCodeForm email={verificationEmail} purpose="signup" onBack={() => setVerificationEmail(null)} />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    const result = await auth.signUp(email.trim(), password, { fullName, phone, address, city });
    setPending(false);
    // What they typed stays in the form, so a refused signup can be retried
    // without entering a name, number and address again.
    if (!result.ok) return toast.error(result.message ?? "Sign-up did not finish. Check your connection and try again.");
    if (result.needsEmailConfirmation) {
      setPassword("");
      setVerificationEmail(email.trim());
      return;
    }
    window.location.replace("/");
  };

  return (
    <AuthFrame
      title="Create an account"
      description="Tell us where the work is, so local pros can quote accurately."
      footer={<>Already have an account? <a className="text-primary hover:underline" href="/login">Sign in</a></>}
    >
      <form className="space-y-4" onSubmit={(event) => void submit(event)}>
        <div className="space-y-2"><Label htmlFor="register-name">Full name</Label><Input id="register-name" autoComplete="name" required value={fullName} onChange={(event) => setFullName(event.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="register-email">Email</Label><Input id="register-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="register-password">Password</Label><Input id="register-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="register-phone">Phone</Label><Input id="register-phone" type="tel" autoComplete="tel" required value={phone} onChange={(event) => setPhone(event.target.value)} /></div>
        <div className="space-y-2">
          <Label htmlFor="register-address">Service address</Label>
          <AddressInput
            id="register-address"
            value={address}
            onChange={setAddress}
            onPick={(suggestion) => {
              setAddress(suggestion.label);
              // The picked address knows its city, so we do not ask twice.
              if (!city) setCity(suggestion.cityLabel);
            }}
            placeholder="Start typing your address, e.g. 123 Main St"
            className="h-[42px] w-full rounded-md border border-input bg-input px-3 text-sm outline-none ring-ring focus:ring-2"
          />
        </div>
        <div className="space-y-2"><Label htmlFor="register-city">City</Label><Input id="register-city" autoComplete="address-level2" placeholder="Akron, OH" required value={city} onChange={(event) => setCity(event.target.value)} /></div>
        <p className="text-xs text-muted-foreground">
          Your address is only shared with the professional you hire, once they accept your job.
        </p>
        <p className="text-xs text-muted-foreground">
          We email a code to confirm your address. Hotmail and Outlook addresses are refused by our
          email sender, so please use Gmail or another provider.
        </p>
        <Button className="w-full" type="submit" disabled={pending}>{pending ? "Creating account…" : "Create account"}</Button>
      </form>
    </AuthFrame>
  );
}

export function ForgotPasswordPage() {
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  if (auth.status === "loading") return <LoadingAuth />;
  if (auth.status === "unavailable") return <UnavailableAuth />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    const result = await auth.requestPasswordReset(email);
    setPending(false);
    result.ok ? toast.success("If this email is registered, you will receive a reset message.") : toast.error(result.message);
  };

  return (
    <AuthFrame title="Reset password" description="We will send a reset link to your email." footer={<a className="text-primary hover:underline" href="/login">Back to sign in</a>}>
      <form className="space-y-4" onSubmit={(event) => void submit(event)}>
        <div className="space-y-2"><Label htmlFor="reset-email">Email</Label><Input id="reset-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></div>
        <Button className="w-full" type="submit" disabled={pending}>{pending ? "Sending…" : "Send reset email"}</Button>
      </form>
    </AuthFrame>
  );
}

export function ResetPasswordPage() {
  const auth = useAuth();
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  if (auth.status === "loading") return <LoadingAuth />;
  if (auth.status === "unavailable") return <UnavailableAuth />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    const result = await auth.updatePassword(password);
    setPending(false);
    if (!result.ok) return toast.error(result.message);
    toast.success("Password updated.");
    window.location.replace("/login");
  };

  return (
    <AuthFrame title="Set a new password" description="Enter a new password for your account.">
      <form className="space-y-4" onSubmit={(event) => void submit(event)}>
        <div className="space-y-2"><Label htmlFor="new-password">New password</Label><Input id="new-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} /></div>
        <Button className="w-full" type="submit" disabled={pending}>{pending ? "Saving…" : "Save new password"}</Button>
      </form>
    </AuthFrame>
  );
}
