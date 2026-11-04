import { test } from "node:test";
import assert from "node:assert/strict";

import { trialState, trialMessage, trialReminder } from "./fixit-trial.ts";

const NOW = new Date("2026-01-01T12:00:00Z");

test("no recorded end means no trial is tracked", () => {
  assert.equal(trialState(null, NOW).kind, "none");
  assert.equal(trialState(undefined, NOW).kind, "none");
  assert.equal(trialMessage(trialState(null, NOW), 49), "");
});

test("a fresh three-month free period is active", () => {
  const state = trialState("2026-03-01T12:00:00Z", NOW);
  assert.equal(state.kind, "active");
  assert.equal(state.daysLeft, 59);
});

test("the last two weeks read as ending soon", () => {
  assert.equal(trialState("2026-01-10T12:00:00Z", NOW).kind, "ending-soon");
  assert.equal(trialState("2026-01-15T12:00:00Z", NOW).kind, "ending-soon");
});

test("a date in the past means the free period is over", () => {
  const state = trialState("2025-12-01T12:00:00Z", NOW);
  assert.equal(state.kind, "over");
  assert.equal(state.daysLeft, 0);
});

test("the sentence names the date and the price that follows", () => {
  const active = trialMessage(trialState("2026-03-01T12:00:00Z", NOW), 99);
  assert.match(active, /59 days left/);
  assert.match(active, /March 1, 2026/);
  assert.match(active, /\$99 a month/);

  const over = trialMessage(trialState("2025-12-01T12:00:00Z", NOW), 49);
  assert.match(over, /ended/);
  assert.match(over, /Start your plan/);
});

test("a bad date is treated as no trial, not as ended", () => {
  assert.equal(trialState("not-a-date", NOW).kind, "none");
});


test("no reminder while the free period is weeks away", () => {
  const ends = new Date(NOW.getTime() + 40 * 86400 * 1000).toISOString();
  assert.equal(trialReminder({ businessName: "Tulip Plumbing", endsAt: ends, plan: "professional", pricePerMonth: 199 }, NOW), null);
});

test("the reminder names the date, the days left and the price, and says nothing is charged", () => {
  const ends = new Date(NOW.getTime() + 10 * 86400 * 1000).toISOString();
  const text = trialReminder({ businessName: "Tulip Plumbing", endsAt: ends, plan: "professional", pricePerMonth: 199 }, NOW);
  assert.ok(text);
  assert.match(text, /Tulip Plumbing/);
  assert.match(text, /10 days left/);
  assert.match(text, /Professional is \$199 a month/);
  assert.match(text, /Nothing is charged automatically/);
});

test("no reminder once the free period has ended", () => {
  const ends = new Date(NOW.getTime() - 86400 * 1000).toISOString();
  assert.equal(trialReminder({ businessName: "Tulip Plumbing", endsAt: ends, plan: "starter", pricePerMonth: 99 }, NOW), null);
});
