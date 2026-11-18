import test from "node:test";
import assert from "node:assert/strict";
import { featuredSeed, featuredTier, pickFeatured } from "../lib/featured-pros.ts";

// Wednesday 18 November 2026, 2:00 pm in Akron.
const NOW = new Date("2026-11-18T19:00:00Z");
const allWeek = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startMinute: 8 * 60, endMinute: 17 * 60 }));

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
  const ids = pickFeatured(arrived, { now: NOW, seed: "any" }).map((p) => p.id);
  assert.deepEqual(ids.slice(0, 2).sort(), ["biz-1", "biz-2"]);
  assert.deepEqual(ids.slice(2).sort(), ["pro-1", "pro-2"]);
});

test("without a seed, equals keep the order they came in", () => {
  const arrived = [
    { id: "a", plan: "business" },
    { id: "b", plan: "business" },
    { id: "c", plan: "business" },
  ];
  assert.deepEqual(pickFeatured(arrived, { now: NOW }).map((p) => p.id), ["a", "b", "c"]);
});

test("someone who can help now comes before an equal-plan pro who cannot", () => {
  const arrived = [
    { id: "closed", plan: "business", hours: [] },
    { id: "open", plan: "business", hours: allWeek },
  ];
  for (const seed of ["1", "2", "3", "4", "5"]) {
    assert.equal(pickFeatured(arrived, { now: NOW, seed })[0].id, "open");
  }
});

test("free and cheapest plans and pros who stopped taking work are left out", () => {
  const arrived = [
    { id: "starter", plan: "starter" },
    { id: "founding", plan: "founding" },
    { id: "paused", plan: "business", acceptingWork: false },
    { id: "ok", plan: "professional", acceptingWork: true },
  ];
  assert.deepEqual(pickFeatured(arrived, { now: NOW }).map((p) => p.id), ["ok"]);
});

test("only as many as there are spots", () => {
  const many = Array.from({ length: 9 }, (_, i) => ({ id: "b" + i, plan: "business" }));
  assert.equal(pickFeatured(many, { now: NOW }).length, 4);
  assert.equal(pickFeatured(many, { now: NOW, slots: 2 }).length, 2);
});

test("the same turn always gives the same order", () => {
  const many = Array.from({ length: 10 }, (_, i) => ({ id: "b" + i, plan: "business" }));
  const seed = featuredSeed(NOW, "Akron, OH");
  const first = pickFeatured(many, { now: NOW, seed }).map((p) => p.id);
  const again = pickFeatured(many, { now: NOW, seed }).map((p) => p.id);
  assert.deepEqual(first, again);
});

test("the order changes from one turn to the next", () => {
  const seedA = featuredSeed(new Date("2026-11-18T19:00:00Z"), "Akron, OH");
  const seedB = featuredSeed(new Date("2026-11-18T19:30:00Z"), "Akron, OH");
  const seedSameTurn = featuredSeed(new Date("2026-11-18T19:10:00Z"), "Akron, OH");
  assert.notEqual(seedA, seedB);
  assert.equal(seedA, seedSameTurn);
});

test("over a day every paying pro gets featured, and none hogs the spots", () => {
  const many = Array.from({ length: 12 }, (_, i) => ({ id: "b" + i, plan: "business" }));
  const timesFeatured = new Map<string, number>();
  const timesFirst = new Map<string, number>();
  const turns = 48; // a day of half hours
  for (let turn = 0; turn < turns; turn += 1) {
    const picked = pickFeatured(many, { now: NOW, seed: String(turn) });
    picked.forEach((p, index) => {
      timesFeatured.set(p.id, (timesFeatured.get(p.id) ?? 0) + 1);
      if (index === 0) timesFirst.set(p.id, (timesFirst.get(p.id) ?? 0) + 1);
    });
  }
  // Fair share would be 16 of 48 turns (4 spots / 12 pros).
  for (const pro of many) {
    const count = timesFeatured.get(pro.id) ?? 0;
    assert.ok(count >= 6, `${pro.id} was featured only ${count} of ${turns} turns`);
    assert.ok(count <= 28, `${pro.id} hogged the spots: ${count} of ${turns} turns`);
  }
  assert.ok(timesFirst.size >= 8, `only ${timesFirst.size} different pros ever held the top spot`);
});
