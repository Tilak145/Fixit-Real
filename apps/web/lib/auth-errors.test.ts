import assert from "node:assert/strict";
import test from "node:test";
import { publicAuthError } from "./auth-errors.ts";

test("an address the email service refuses is explained instead of hidden", () => {
  const error = new Error(
    "Email to this address bounced or was reported as spam before, so it is no longer sent. Use a different address.",
  );
  const message = publicAuthError(error);
  assert.match(message, /undeliverable/);
  assert.match(message, /password/);
  assert.notEqual(message, "The operation could not be completed. Please try again.");
});

test("the ordinary cases keep their own wording", () => {
  assert.match(publicAuthError(new Error("Invalid login credentials")), /incorrect/);
  assert.match(publicAuthError(new Error("Email not confirmed")), /Verify your email/);
  assert.match(publicAuthError(new Error("Token has expired or is invalid")), /invalid or has expired/i);
});

test("an unrecognised failure still says something, without leaking the raw text", () => {
  assert.equal(
    publicAuthError(new Error("some internal socket failure")),
    "The operation could not be completed. Please try again.",
  );
  assert.equal(publicAuthError("not an error"), "The operation could not be completed. Please try again.");
});
