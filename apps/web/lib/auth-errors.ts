/**
 * Turns whatever the accounts service says into one sentence a person can act
 * on. Shared so the management door and the customer sign-in explain the same
 * failure the same way, and so the wording can be tested without a browser.
 */
export function publicAuthError(error: unknown): string {
  if (!(error instanceof Error)) return "The operation could not be completed. Please try again.";
  const message = error.message.toLowerCase();
  if (message.includes("expired") || message.includes("invalid otp")) return "This code is invalid or has expired. Request a new email and try again.";
  if ((message.includes("bounced") || message.includes("reported as spam")) && message.includes("email"))
    return "This email address was reported as undeliverable, so sign-in emails cannot reach it. Sign in with your password instead, or use a different address for the account.";
  if (message.includes("rate limit") || message.includes("too many") || message.includes("after")) return "Please wait before requesting another email, then try again.";
  if (message.includes("invalid login credentials")) return "The email or password is incorrect.";
  if (message.includes("email not confirmed")) return "Verify your email before signing in.";
  if (message.includes("already registered")) return "This email is already registered.";
  if (message.includes("password")) return "The password does not meet the requirements.";
  if (message.includes("not enabled")) return error.message;
  return "The operation could not be completed. Please try again.";
}
