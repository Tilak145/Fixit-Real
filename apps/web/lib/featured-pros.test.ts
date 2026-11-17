import test from "node:test";
import assert from "node:assert/strict";
import { featuredTier, pickFeatured } from "./featured-pros.ts";

test("only the two highest-paying plans are featured", () => {
  assert.equal(featuredTier("business"), 0);
  assert.equal(featuredTier("professional"), 1);
  assert.equal(featuredTier("starter"), null);
  assert.equal(featuredTier("founding"), null);
  assert.equal(featuredTier(null), null);
});

test("Business comes before Professional, whatever order they arrive in", () => {
  const arrived = [
    { id: "pro-1", plan: "professional" },
    { id: "biz-1", plan: "business" },
    { id: "pro-2", plan: "professional" },
    { id: "biz-2", plan: "business" },
  ];
  assert.deepEqual(pickFeatured(arrived).map((p) => p.id), ["biz-1", "biz-2", "pro-1", "pro-2"]);
});

test("equals keep the order they came in, which is soonest available then rating", () => {
  const arrived = [
    { id: "a", plan: "business" },
    { id: "b", plan: "business" },
    { id: "c", plan: "business" },
  ];
  assert.deepEqual(pickFeatured(arrived).map((p) => p.id), ["a", "b", "c"]);
});

test("free and cheapest plans and pros who stopped taking work are left out", () => {
  const arrived = [
    { id: "starter", plan: "starter" },
    { id: "founding", plan: "founding" },
    { id: "paused", plan: "business", acceptingWork: false },
    { id: "ok", plan: "professional", acceptingWork: true },
  ];
  assert.deepEqual(pickFeatured(arrived).map((p) => p.id), ["ok"]);
});

test("only as many as there are spots", () => {
  const many = Array.from({ length: 9 }, (_, i) => ({ id: "b" + i, plan: "business" }));
  assert.equal(pickFeatured(many).length, 4);
  assert.equal(pickFeatured(many, 2).length, 2);
});
