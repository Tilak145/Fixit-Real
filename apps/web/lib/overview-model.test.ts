import assert from "node:assert/strict";
import { test } from "node:test";
import {
  axisTop,
  changeFromLastMonth,
  completedThisMonth,
  greeting,
  monthlySpending,
  openParts,
  splitVisits,
} from "./overview-model.ts";

const now = new Date(2026, 10, 20, 12, 0);
const at = (month: number, day: number, hour = 12) => new Date(2026, month, day, hour).toISOString();

test("spending is added into the month it was agreed", () => {
  const months = monthlySpending([{ at: at(10, 2), cents: 100 }, { at: at(10, 9), cents: 50 }, { at: at(9, 1), cents: 200 }, { at: at(0, 1), cents: 999 }], now);
  assert.deepEqual(months.map((month) => month.label), ["Jun", "Jul", "Aug", "Sep", "Oct", "Nov"]);
  assert.deepEqual(months.map((month) => month.cents), [0, 0, 0, 0, 200, 150]);
  assert.equal(changeFromLastMonth(months), -25);
});

test("no percentage when last month was empty", () => {
  assert.equal(changeFromLastMonth(monthlySpending([{ at: at(10, 2), cents: 100 }], now)), null);
});

test("the axis has a round top", () => {
  assert.equal(axisTop(0), 100);
  assert.equal(axisTop(18_000), 200);
  assert.equal(axisTop(279_000), 4000);
});

test("open repairs are split without counting one twice", () => {
  const parts = openParts([
    { status: "submitted", priority: "urgent" },
    { status: "awaiting_approval", priority: "normal" },
    { status: "scheduled", priority: "low" },
    { status: "in_progress", priority: "normal" },
    { status: "completed", priority: "urgent" },
  ]);
  assert.deepEqual(parts.map((part) => part.count), [1, 1, 1, 1]);
  assert.equal(completedThisMonth([{ status: "completed", updated_at: at(10, 3) }, { status: "completed", updated_at: at(8, 3) }], now), 1);
});

test("visits are split into today and later, leaving out past and cancelled ones", () => {
  const visit = (scheduled_for: string, status = "scheduled") => ({ scheduled_for, status });
  const result = splitVisits([visit(at(10, 25)), visit(at(10, 20, 9)), visit(at(10, 19)), visit(at(10, 20, 15), "cancelled")], now);
  assert.equal(result.today.length, 1);
  assert.equal(result.later.length, 1);
});

test("the greeting follows the time of day", () => {
  assert.equal(greeting(new Date(2026, 0, 1, 8)), "Good morning!");
  assert.equal(greeting(new Date(2026, 0, 1, 20)), "Good evening!");
});
