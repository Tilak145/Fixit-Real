import { test } from "node:test";
import assert from "node:assert/strict";

import { groupNumber, digitsOf } from "./fixit-numbers.ts";

test("a nine-digit business number reads in threes", () => {
  assert.equal(groupNumber("304215887"), "304 215 887");
});

test("an already grouped number is not double-spaced", () => {
  assert.equal(groupNumber("304 215 887"), "304 215 887");
  assert.equal(groupNumber("304-215-887"), "304 215 887");
});

test("anything that is not nine digits is left exactly as given", () => {
  assert.equal(groupNumber("552376"), "552376");
  assert.equal(groupNumber("Being assigned"), "Being assigned");
});

test("spaces typed by a person are removed before a look-up", () => {
  assert.equal(digitsOf("304 215 887"), "304215887");
  assert.equal(digitsOf(" 304-215-887 "), "304215887");
});
