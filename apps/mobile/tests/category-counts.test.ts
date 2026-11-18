import test from "node:test";
import assert from "node:assert/strict";
import { countProsByCategory } from "../lib/category-counts.ts";
import type { AvailabilityFacts } from "../lib/fixit-live-availability.ts";

// Wednesday 18 November 2026, 2:00 pm in Akron (19:00 UTC).
const WEDNESDAY_2PM = new Date("2026-11-18T19:00:00Z");
const allWeek = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startMinute: 8 * 60, endMinute: 17 * 60 }));

const facts = (patch: Partial<AvailabilityFacts>): AvailabilityFacts => ({
  acceptingWork: true,
  acceptsEmergency: false,
  windows: allWeek,
  ...patch,
});

test("only professionals who can be reached right now count as available", () => {
  const pros = new Map<string, AvailabilityFacts>([
    ["open", facts({})],
    ["paused", facts({ acceptingWork: false })],
    ["no-hours", facts({ windows: [] })],
    ["evenings", facts({ windows: [{ weekday: 3, startMinute: 18 * 60, endMinute: 22 * 60 }] })],
    ["day-off", facts({ windows: allWeek.filter((window) => window.weekday !== 3) })],
  ]);
  const services = [...pros.keys()].map((provider_id) => ({ provider_id, category_slug: "plumbing" }));
  assert.deepEqual(countProsByCategory(services, pros, WEDNESDAY_2PM), {
    plumbing: { total: 5, availableNow: 1 },
  });
});

test("each trade is counted on its own, and a repeated row is counted once", () => {
  const pros = new Map([["a", facts({})], ["b", facts({})]]);
  const services = [
    { provider_id: "a", category_slug: "plumbing" },
    { provider_id: "a", category_slug: "plumbing" },
    { provider_id: "a", category_slug: "handyman" },
    { provider_id: "b", category_slug: "handyman" },
    { provider_id: "someone-in-another-city", category_slug: "handyman" },
  ];
  assert.deepEqual(countProsByCategory(services, pros, WEDNESDAY_2PM), {
    plumbing: { total: 1, availableNow: 1 },
    handyman: { total: 2, availableNow: 2 },
  });
});

test("after closing time nobody is available, but they are still counted in the total", () => {
  const pros = new Map([["a", facts({})]]);
  const services = [{ provider_id: "a", category_slug: "plumbing" }];
  const tenAtNight = new Date("2026-11-19T03:00:00Z");
  assert.deepEqual(countProsByCategory(services, pros, tenAtNight), { plumbing: { total: 1, availableNow: 0 } });
});
