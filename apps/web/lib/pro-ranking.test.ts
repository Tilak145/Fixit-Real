import test from "node:test";
import assert from "node:assert/strict";
import {
  PAGE_SIZE,
  countByFilter,
  parseFilter,
  parsePage,
  placementForPlan,
  rankPros,
  takePages,
} from "./pro-ranking.ts";
import type { AvailabilityFacts } from "./fixit-live-availability.ts";

// Wednesday 18 November 2026, 2:00 pm in Akron.
const NOW = new Date("2026-11-18T19:00:00Z");
const allWeek = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startMinute: 8 * 60, endMinute: 17 * 60 }));
const open: AvailabilityFacts = { acceptingWork: true, acceptsEmergency: false, windows: allWeek };
const noHours: AvailabilityFacts = { acceptingWork: true, acceptsEmergency: false, windows: [] };
const paused: AvailabilityFacts = { acceptingWork: false, acceptsEmergency: false, windows: allWeek };

test("plans map to the same placements the database uses", () => {
  assert.equal(placementForPlan("business"), 10);
  assert.equal(placementForPlan("professional"), 20);
  assert.equal(placementForPlan("founding"), 20);
  assert.equal(placementForPlan("starter"), 30);
  assert.equal(placementForPlan(null), 30);
});

test("a paying pro with no reviews outranks better-rated pros who pay less", () => {
  const pros = [
    { id: "starter-5-stars", facts: open, rating: 5, placement: placementForPlan("starter") },
    { id: "business-new", facts: open, rating: 0, placement: placementForPlan("business") },
    { id: "professional-4", facts: open, rating: 4, placement: placementForPlan("professional") },
  ];
  assert.deepEqual(rankPros(pros, NOW).map((p) => p.id), ["business-new", "professional-4", "starter-5-stars"]);
});

test("someone open now still comes before a higher plan that is not", () => {
  const pros = [
    { id: "business-paused", facts: paused, rating: 5, placement: 10 },
    { id: "starter-open", facts: open, rating: 3, placement: 30 },
    { id: "business-no-hours", facts: noHours, rating: 5, placement: 10 },
  ];
  assert.deepEqual(rankPros(pros, NOW).map((p) => p.id), ["starter-open", "business-no-hours", "business-paused"]);
});

test("ranking does not change the list it was given", () => {
  const pros = [
    { id: "b", facts: open, rating: 1, placement: 30 },
    { id: "a", facts: open, rating: 1, placement: 10 },
  ];
  rankPros(pros, NOW);
  assert.deepEqual(pros.map((p) => p.id), ["b", "a"]);
});

test("with hundreds of pros every one can be reached by paging", () => {
  const many = Array.from({ length: 300 }, (_, i) => ({ id: "p" + i, facts: open, rating: 0, placement: 30 }));
  const ranked = rankPros(many, NOW);
  const first = takePages(ranked, 1);
  assert.equal(first.items.length, PAGE_SIZE);
  assert.equal(first.hasMore, true);
  const last = takePages(ranked, 25);
  assert.equal(last.items.length, 300);
  assert.equal(last.hasMore, false);
  assert.equal(new Set(last.items.map((p) => p.id)).size, 300);
});

test("show more adds to what is already shown", () => {
  const ranked = Array.from({ length: 30 }, (_, i) => i);
  assert.deepEqual(takePages(ranked, 2).items, ranked.slice(0, 24));
  assert.equal(takePages(ranked, 3).hasMore, false);
});

test("filter counts cover the whole list, not just one page", () => {
  const pros = [
    { facts: open },
    { facts: open },
    { facts: noHours },
    { facts: paused },
  ];
  const counts = countByFilter(pros, NOW);
  assert.equal(counts.any, 3);
  assert.equal(counts.today, 2);
  assert.equal(counts.tomorrow, 2);
  assert.equal(counts.emergency, 0);
});

test("links with odd filters or pages fall back safely", () => {
  assert.equal(parseFilter("today"), "today");
  assert.equal(parseFilter("everything"), "any");
  assert.equal(parseFilter(undefined), "any");
  assert.equal(parsePage("3"), 3);
  assert.equal(parsePage("0"), 1);
  assert.equal(parsePage("-4"), 1);
  assert.equal(parsePage("abc"), 1);
  assert.equal(parsePage("99999"), 50);
});
