"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import type { Session, User } from "@supabase/supabase-js";

import { getSupabase, requireSupabase } from "@/lib/supabase";
import { publicAuthError } from "@/lib/auth-errors";

export type AuthStatus =
  | "loading"
  | "authenticated"
  | "anonymous"
  | "unavailable";

export interface AuthActionResult {
  ok: boolean;
  message?: string;
  needsEmailConfirmation?: boolean;
}

interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  signIn(email: string, password: string): Promise<AuthActionResult>;
  signUp(
    email: string,
    password: string,
    profile?: { fullName?: string; phone?: string; address?: string; city?: string },
    emailRedirectTo?: string,
  ): Promise<AuthActionResult>;
  verifyEmailCode(email: string, token: string): Promise<AuthActionResult>;
  resendEmailConfirmation(email: string): Promise<AuthActionResult>;
  requestEmailSignIn(email: string, redirectTo?: string): Promise<AuthActionResult>;
  signOut(): Promise<AuthActionResult>;
  requestPasswordReset(email: string): Promise<AuthActionResult>;
  updatePassword(password: string): Promise<AuthActionResult>;
}

const AuthContext = createContext<AuthContextValue | null>(null);


function failed(error: unknown): AuthActionResult {
  return { ok: false, message: publicAuthError(error) };
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  useEffect(() => {
    // beforeInteractive finishes before hydration; both initial renders stay loading.
    const supabase = getSupabase();
    if (!supabase) {
      setStatus("unavailable");
      return;
    }
    let active = true;
    // An emailed link that was already used, or has run out, comes back with
    // only an error in the address. Left alone the person sees the home page
    // and no explanation, so send them to where they can ask for a new one.
    if (
      /[#&]error_code=otp_expired/u.test(window.location.hash) &&
      window.location.pathname !== "/forgot-password"
    ) {
      window.location.replace("/forgot-password?expired=1");
      return;
    }
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      setSession(error ? null : data.session);
      setStatus(!error && data.session ? "authenticated" : "anonymous");
    }).catch(() => {
      if (!active) return;
      setSession(null);
      setStatus("anonymous");
    });
    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      // A password-reset link signs the person in wherever it lands. When the
      // link's own destination is not on the allowed list, the sign-in service
      // sends them to the home page instead, and they were never asked for a
      // new password. Whatever page they arrive on, take them to that step.
      if (event === "PASSWORD_RECOVERY" && window.location.pathname !== "/reset-password") {
        window.location.replace("/reset-password");
        return;
      }
      setSession(nextSession);
      setStatus(nextSession ? "authenticated" : "anonymous");
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { error } = await requireSupabase().auth.signInWithPassword({
        email,
        password,
      });
      return error ? failed(error) : { ok: true };
    } catch (error) {
      return failed(error);
    }
  }, []);

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      profile?: { fullName?: string; phone?: string; address?: string; city?: string },
      emailRedirectTo?: string,
    ) => {
      try {
        // The name and address are stored on the account itself, so they
        // survive the email-confirmation step, where there is no session yet
        // and the database would refuse the write.
        const { data, error } = await requireSupabase().auth.signUp({
          email,
          password,
          options: {
            // Where the confirmation link lands, so a new provider arrives in
            // onboarding rather than on the public home page.
            emailRedirectTo: emailRedirectTo
              ? new URL(emailRedirectTo, window.location.origin).href
              : undefined,
            data: {
              full_name: profile?.fullName?.trim() || null,
              phone: profile?.phone?.trim() || null,
              address: profile?.address?.trim() || null,
              city: profile?.city?.trim() || null,
            },
          },
        });
        if (error) return failed(error);
        // An email that already has an account gets a normal-looking answer with
        // no identities, and no email is sent. Say so, or the person waits for
        // a code that will never arrive.
        if (!data.session && data.user && (data.user.identities?.length ?? 0) === 0) {
          return {
            ok: false,
            message:
              "This email already has a FixIt account, so no new email was sent. Log in instead, or use Forgot password.",
          };
        }
        return { ok: true, needsEmailConfirmation: !data.session };
      } catch (error) {
        return failed(error);
      }
    },
    [],
  );

  const signOut = useCallback(async () => {
    try {
      const { error } = await requireSupabase().auth.signOut();
      return error ? failed(error) : { ok: true };
    } catch (error) {
      return failed(error);
    }
  }, []);

  const verifyEmailCode = useCallback(async (email: string, token: string) => {
    try {
      const { data, error } = await requireSupabase().auth.verifyOtp({ email, token: token.trim(), type: "email" });
      if (error) return failed(error);
      return data.session ? { ok: true } : { ok: false, message: "Sign-in could not be completed. Request a new email and try again." };
    } catch (error) {
      return failed(error);
    }
  }, []);

  const resendEmailConfirmation = useCallback(async (email: string) => {
    try {
      const { error } = await requireSupabase().auth.resend({ type: "signup", email });
      return error ? failed(error) : { ok: true };
    } catch (error) {
      return failed(error);
    }
  }, []);

  const requestEmailSignIn = useCallback(async (email: string, redirectTo = "/") => {
    try {
      const { error } = await requireSupabase().auth.signInWithOtp({
        email, options: { shouldCreateUser: false, emailRedirectTo: new URL(redirectTo, window.location.origin).href },
      });
      return error ? failed(error) : { ok: true };
    } catch (error) {
      return failed(error);
    }
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    try {
      const redirectTo = new URL("/reset-password", window.location.origin).href;
      const { error } = await requireSupabase().auth.resetPasswordForEmail(email, {
        redirectTo,
      });
      return error ? failed(error) : { ok: true };
    } catch (error) {
      return failed(error);
    }
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    try {
      const { error } = await requireSupabase().auth.updateUser({ password });
      return error ? failed(error) : { ok: true };
    } catch (error) {
      return failed(error);
    }
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    status,
    session,
    user: session?.user ?? null,
    signIn,
    signUp,
    verifyEmailCode,
    resendEmailConfirmation,
    requestEmailSignIn,
    signOut,
    requestPasswordReset,
    updatePassword,
  }), [
    requestPasswordReset,
    verifyEmailCode,
    resendEmailConfirmation,
    requestEmailSignIn,
    session,
    signIn,
    signOut,
    signUp,
    status,
    updatePassword,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
/**

/**
 * What a person who is waiting for an email code most often needs: where the
 * message went and which mailbox to check. Sign-up screens show it after they
 * submit, whether or not the sending service accepted the address.
 */
export function emailCodeAdvice(email: string): string {
  const address = email.trim() || "your email";
  return (
    `We sent a code to ${address}. If it is not in your inbox within a few minutes, ` +
    "check spam and promotions, then press Resend email. If it still does not arrive, " +
    "some mail providers (Hotmail and Outlook among them) are refused by our email sender — " +
    "sign up again with a different email address, such as Gmail."
  );
}
