import { test } from "node:test";
import assert from "node:assert/strict";

import { PRO_HOME, landingFor } from "./landing-path.ts";

test("a pro who signs in with nothing in particular asked for goes to their dashboard", () => {
  assert.equal(landingFor("/", true), PRO_HOME);
  assert.equal(landingFor(undefined, true), PRO_HOME);
  assert.equal(landingFor(null, true), PRO_HOME);
  assert.equal(landingFor("", true), PRO_HOME);
});

test("a customer who signs in stays on the home page", () => {
  assert.equal(landingFor("/", false), "/");
  assert.equal(landingFor(undefined, false), "/");
});

test("a page that was asked for is never replaced", () => {
  assert.equal(landingFor("/pro/onboarding", true), "/pro/onboarding");
  assert.equal(landingFor("/account", true), "/account");
  assert.equal(landingFor("/services/plumbing", true), "/services/plumbing");
  assert.equal(landingFor("/pro/onboarding", false), "/pro/onboarding");
  assert.equal(landingFor("/?city=Kent", true), "/?city=Kent");
});

test("the pro dashboard is the dashboard page", () => {
  assert.equal(PRO_HOME, "/pro/dashboard");
});
