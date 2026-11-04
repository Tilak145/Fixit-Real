import { test } from "node:test";
import assert from "node:assert/strict";

import {
  parseDollarsToCents,
  formatCents,
  formatBudgetRange,
  budgetOverlaps,
  validateBudgetRange,
} from "./fixit-budget.ts";

test("a typed dollar amount becomes cents", () => {
  assert.equal(parseDollarsToCents("1200"), 120_000);
  assert.equal(parseDollarsToCents("$1,200"), 120_000);
  assert.equal(parseDollarsToCents(" 750 "), 75_000);
});

test("a blank or unreadable amount is no budget, not zero", () => {
  assert.equal(parseDollarsToCents(""), null);
  assert.equal(parseDollarsToCents("   "), null);
  assert.equal(parseDollarsToCents(null), null);
  assert.equal(parseDollarsToCents("abc"), null);
});

test("cents format back to whole dollars", () => {
  assert.equal(formatCents(120_000), "$1,200");
  assert.equal(formatCents(null), "—");
});

test("a full range reads as a span", () => {
  assert.equal(formatBudgetRange({ minCents: 50_000, maxCents: 100_000 }), "$500 – $1,000");
  assert.equal(formatBudgetRange({ minCents: null, maxCents: 25_000 }), "Up to $250");
  assert.equal(formatBudgetRange({ minCents: 250_000, maxCents: null }), "$2,500 or more");
});

test("a missing range says so rather than showing nothing", () => {
  assert.equal(formatBudgetRange(null), "Budget not given");
  assert.equal(formatBudgetRange({ minCents: null, maxCents: null }), "Budget not given");
});

test("an unknown budget on either side never hides a job", () => {
  const pref = { minCents: 50_000, maxCents: 100_000 };
  assert.equal(budgetOverlaps(null, pref), true);
  assert.equal(budgetOverlaps({ minCents: 90_000, maxCents: 200_000 }, null), true);
});

test("overlapping ranges match and disjoint ones do not", () => {
  const pref = { minCents: 50_000, maxCents: 100_000 };
  assert.equal(budgetOverlaps({ minCents: 80_000, maxCents: 150_000 }, pref), true);
  assert.equal(budgetOverlaps({ minCents: 200_000, maxCents: 300_000 }, pref), false);
  assert.equal(budgetOverlaps({ minCents: null, maxCents: 40_000 }, pref), false);
});

test("a backwards range is a mistake worth naming", () => {
  assert.equal(validateBudgetRange(100_000, 50_000), "The highest amount should be at least as much as the lowest.");
  assert.equal(validateBudgetRange(50_000, 100_000), null);
  assert.equal(validateBudgetRange(null, 100_000), null);
});

