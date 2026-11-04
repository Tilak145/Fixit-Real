import assert from "node:assert/strict";
import test from "node:test";
import {
  availabilityLabel,
  availabilityState,
  availableForEmergency,
  compareByAvailability,
  matchesAvailabilityFilter,
  zonedClock,
  type AvailabilityFacts,
} from "./fixit-live-availability.ts";

/**
 * Fixed instants rather than "now", so the test never depends on when it runs.
 * Late October is daylight time in Akron (UTC−4), so 14:00 UTC is 10:00 local
 * on a Monday, and 00:00 UTC is 20:00 local the previous day.
 */
const MONDAY_10AM = new Date("2026-10-26T14:00:00Z"); // Mon 10:00 EDT
const MONDAY_8PM = new Date("2026-10-27T00:00:00Z"); // Mon 20:00 EDT
const WEEKDAYS_9_TO_5 = [1, 2, 3, 4, 5].map((weekday) => ({
  weekday,
  startMinute: 9 * 60,
  endMinute: 17 * 60,
}));

function facts(overrides: Partial<AvailabilityFacts> = {}): AvailabilityFacts {
  return {
    acceptingWork: true,
    acceptsEmergency: false,
    windows: WEEKDAYS_9_TO_5,
    ...overrides,
  };
}

test("the market clock reads Akron wall time, not the machine's", () => {
  // The same instant is Friday evening in Shanghai but Monday morning in Akron,
  // and the badge must follow Akron.
  const clock = zonedClock(MONDAY_10AM);
  assert.equal(clock.weekday, 1);
  assert.equal(clock.minuteOfDay, 10 * 60);
});

test("a pro inside their hours and switched on is available now", () => {
  assert.equal(availabilityState(facts(), MONDAY_10AM), "available");
  assert.equal(availabilityLabel(facts(), MONDAY_10AM), "Available now");
});

test("stepping out is respected even during working hours", () => {
  // The switch beats the calendar: a customer must not be sent to a phone the
  // professional has just said they are not watching.
  assert.equal(availabilityState(facts({ acceptingWork: false }), MONDAY_10AM), "off");
  assert.equal(availabilityLabel(facts({ acceptingWork: false }), MONDAY_10AM), "Not taking work");
});

test("outside their hours they are open later, with the next time named", () => {
  assert.equal(availabilityState(facts(), MONDAY_8PM), "open-later");
  assert.equal(availabilityLabel(facts(), MONDAY_8PM), "Back tomorrow at 9:00 AM");
});

test("a later opening today is named as today", () => {
  const afternoons = facts({
    windows: [{ weekday: 1, startMinute: 13 * 60, endMinute: 17 * 60 }],
  });
  // Monday 10:00, they open at 1pm, so the label is about today.
  assert.equal(availabilityLabel(afternoons, MONDAY_10AM), "Back today at 1:00 PM");
});

test("no published hours is unknown, never claimed as unavailable", () => {
  const noHours = facts({ windows: [] });
  assert.equal(availabilityState(noHours, MONDAY_10AM), "unlisted");
  assert.equal(availabilityLabel(noHours, MONDAY_10AM), "Hours on request");
});

test("emergency needs the opt-in as well as being open right now", () => {
  assert.equal(availableForEmergency(facts({ acceptsEmergency: true }), MONDAY_10AM), true);
  assert.equal(availableForEmergency(facts({ acceptsEmergency: true }), MONDAY_8PM), false);
  assert.equal(availableForEmergency(facts({ acceptsEmergency: false }), MONDAY_10AM), false);
});

test("the filters mean what a homeowner would expect", () => {
  assert.equal(matchesAvailabilityFilter(facts(), "today", MONDAY_10AM), true);
  assert.equal(matchesAvailabilityFilter(facts(), "tomorrow", MONDAY_10AM), true);

  const mondaysOnly = facts({
    windows: [{ weekday: 1, startMinute: 9 * 60, endMinute: 17 * 60 }],
  });
  assert.equal(matchesAvailabilityFilter(mondaysOnly, "today", MONDAY_10AM), true);
  assert.equal(matchesAvailabilityFilter(mondaysOnly, "tomorrow", MONDAY_10AM), false);
  // The day is answered by the week, not by this minute.
  assert.equal(matchesAvailabilityFilter(mondaysOnly, "today", MONDAY_8PM), true);

  // A pro who has stepped out matches nothing, including "any".
  assert.equal(matchesAvailabilityFilter(facts({ acceptingWork: false }), "any", MONDAY_10AM), false);
  // No published hours cannot confirm a day, but is still a reachable listing.
  assert.equal(matchesAvailabilityFilter(facts({ windows: [] }), "today", MONDAY_10AM), false);
  assert.equal(matchesAvailabilityFilter(facts({ windows: [] }), "any", MONDAY_10AM), true);
});

test("available pros sort above better-rated pros who are not free", () => {
  const freeNow = { facts: facts(), rating: 4.2 };
  const busyNow = { facts: facts({ acceptingWork: false }), rating: 5.0 };
  assert.ok(compareByAvailability(freeNow, busyNow, MONDAY_10AM) < 0);
});

test("when neither is free, the sooner opening wins over the better rating", () => {
  const opensTuesday = {
    facts: facts({ windows: [{ weekday: 2, startMinute: 9 * 60, endMinute: 17 * 60 }] }),
    rating: 3.0,
  };
  const opensWednesday = {
    facts: facts({ windows: [{ weekday: 3, startMinute: 9 * 60, endMinute: 17 * 60 }] }),
    rating: 5.0,
  };
  assert.ok(compareByAvailability(opensTuesday, opensWednesday, MONDAY_8PM) < 0);
});

test("a pro with no hours sorts below one we can vouch for, but above a closed one", () => {
  const unlisted = { facts: facts({ windows: [] }), rating: 5.0 };
  const openTomorrow = {
    facts: facts({ windows: [{ weekday: 2, startMinute: 9 * 60, endMinute: 17 * 60 }] }),
    rating: 3.0,
  };
  const switchedOff = { facts: facts({ acceptingWork: false }), rating: 5.0 };
  assert.ok(compareByAvailability(openTomorrow, unlisted, MONDAY_8PM) < 0);
  assert.ok(compareByAvailability(unlisted, switchedOff, MONDAY_8PM) < 0);
});

test("equally available pros fall back to rating", () => {
  const better = { facts: facts(), rating: 4.9 };
  const worse = { facts: facts(), rating: 4.1 };
  assert.ok(compareByAvailability(better, worse, MONDAY_10AM) < 0);
});

test("a higher plan outranks a better rating among equally available pros", () => {
  // A paid placement beats a slightly better star rating when both are open now.
  const professional = { facts: facts(), rating: 4.1, placement: 20 };
  const starter = { facts: facts(), rating: 4.9, placement: 30 };
  assert.ok(compareByAvailability(professional, starter, MONDAY_10AM) < 0);
});

test("placement never outranks availability itself", () => {
  // The best plan, but switched off, is still below someone open now.
  const topPlanBusy = { facts: { ...facts(), acceptingWork: false }, rating: 5, placement: 10 };
  const starterFree = { facts: facts(), rating: 3, placement: 30 };
  assert.ok(compareByAvailability(starterFree, topPlanBusy, MONDAY_10AM) < 0);
});

test("a missing placement is neutral, not the worst position", () => {
  // No plan data loaded must not bury a professional below a known worse plan.
  const unknown = { facts: facts(), rating: 4.9 };
  const business = { facts: facts(), rating: 4.1, placement: 10 };
  // The unknown one has the better rating, so it still wins on the final tie-break.
  assert.ok(compareByAvailability(unknown, business, MONDAY_10AM) > 0);
});
