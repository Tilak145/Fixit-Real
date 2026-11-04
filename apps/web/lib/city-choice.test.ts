import { test } from "node:test";
import assert from "node:assert/strict";

import { resolveCity } from "./city-choice.ts";

const ACTIVE = ["Akron, OH", "Cuyahoga Falls, OH", "Kent, OH"];

test("the first served city is the default when nothing else applies", () => {
  assert.equal(resolveCity(ACTIVE, null, null), "Akron, OH");
  assert.equal(resolveCity(ACTIVE, undefined, undefined), "Akron, OH");
});

test("a city in the URL wins, because a shared link should keep its promise", () => {
  assert.equal(resolveCity(ACTIVE, "Kent, OH", "Akron, OH"), "Kent, OH");
});

test("the remembered choice applies when the URL names nothing", () => {
  assert.equal(resolveCity(ACTIVE, null, "Cuyahoga Falls, OH"), "Cuyahoga Falls, OH");
});

test("a value that is not a served city is ignored", () => {
  assert.equal(resolveCity(ACTIVE, "Cleveland, OH", null), "Akron, OH");
  assert.equal(resolveCity(ACTIVE, null, "Narnia, OH"), "Akron, OH");
});

test("with no served cities there is no city, not an invented one", () => {
  assert.equal(resolveCity([], "Akron, OH", "Akron, OH"), null);
  assert.equal(resolveCity([], null, null), null);
});

