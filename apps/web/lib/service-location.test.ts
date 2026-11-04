import { test } from "node:test";
import assert from "node:assert/strict";

import { toPoint, milesBetween, driveMinutes, routeLabel } from "./service-location.ts";

// Two Akron points: downtown and Montrose, a few miles apart.
const DOWNTOWN = { lat: 41.0814, lng: -81.519 };
const MONTROSE = { lat: 41.1103, lng: -81.6174 };

test("a missing or blank location has no point", () => {
  assert.equal(toPoint(null), null);
  assert.equal(toPoint({}), null);
  assert.equal(toPoint({ lat: null, lng: null }), null);
  assert.equal(toPoint({ lat: 0, lng: 0 }), null);
  assert.equal(toPoint({ lat: 200, lng: -81 }), null);
});

test("the same place is zero miles", () => {
  const point = toPoint(DOWNTOWN);
  assert.ok(point);
  assert.equal(milesBetween(point, point), 0);
});

test("distance between two known Akron points is a realistic few miles", () => {
  const miles = milesBetween(DOWNTOWN, MONTROSE);
  assert.ok(miles > 4 && miles < 8, `expected 4-8 miles, got ${miles}`);
});

test("drive time never falls below a few minutes and grows with distance", () => {
  assert.ok(driveMinutes(0) >= 3);
  assert.ok(driveMinutes(5) > driveMinutes(1));
});

test("the route label reads in minutes and miles, or is absent without a location", () => {
  assert.match(routeLabel(DOWNTOWN, MONTROSE) ?? "", /^\d+ min · \d+\.\d mi$/);
  assert.equal(routeLabel(null, MONTROSE), null);
  assert.equal(routeLabel(DOWNTOWN, {}), null);
});
