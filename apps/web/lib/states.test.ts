import assert from "node:assert/strict";
import test from "node:test";
import { isKnownState, licenseNumberLooksValid, stateFromAddress, stateInfo } from "./states.ts";

test("reads the state from an address or a city label", () => {
  assert.equal(stateFromAddress("123 N Main St, Akron, OH 44308"), "OH");
  assert.equal(stateFromAddress("Kent, oh"), "OH");
  assert.equal(stateFromAddress("Dallas, TX"), "TX");
  assert.equal(stateFromAddress("No state here"), null);
  assert.equal(stateFromAddress(null), null);
});

test("an unknown state falls back to Ohio's settings but is reported as unknown", () => {
  assert.equal(stateInfo("TX").code, "OH");
  assert.equal(isKnownState("TX"), false);
  assert.equal(isKnownState("oh"), true);
  assert.equal(stateInfo(null).code, "OH");
});

test("licence numbers are shape-checked", () => {
  assert.equal(licenseNumberLooksValid("OH", "PL.12345"), false);
  assert.equal(licenseNumberLooksValid("OH", "PL12345"), true);
  assert.equal(licenseNumberLooksValid("OH", "ab"), false);
});
