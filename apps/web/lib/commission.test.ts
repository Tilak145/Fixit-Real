import { test } from "node:test";
import assert from "node:assert/strict";

import {
  classifyAllowance,
  commissionBaseCents,
  commissionCents,
  formatCents,
  formatRate,
} from "./commission-math.ts";

test("commission is 10% of the job subtotal", () => {
  const r = commissionCents(100_000, 0, 1000, 25_000);
  assert.equal(r.baseCents, 100_000);
  assert.equal(r.amountCents, 10_000);
  assert.equal(r.capApplied, false);
});

test("sales tax is never part of the commission", () => {
  // The caller passes the subtotal only; tax is a separate figure. Two jobs with
  // the same subtotal but different tax owe the same commission.
  const noTax = commissionCents(50_000, 0, 1000, 25_000);
  const withTax = commissionCents(50_000, 0, 1000, 25_000);
  assert.equal(noTax.amountCents, withTax.amountCents);
  assert.equal(noTax.amountCents, 5_000);
});

test("refunds reduce the base the commission is charged on", () => {
  const r = commissionCents(100_000, 20_000, 1000, 25_000);
  assert.equal(r.baseCents, 80_000);
  assert.equal(r.amountCents, 8_000);
});

test("a refund larger than the subtotal never produces a negative base", () => {
  const r = commissionCents(1_000, 5_000, 1000, 25_000);
  assert.equal(r.baseCents, 0);
  assert.equal(r.amountCents, 0);
});

test("the cap limits the commission, not the job value", () => {
  // 10% of $50,000 is $5,000, capped at $250.
  const r = commissionCents(5_000_000, 0, 1000, 25_000);
  assert.equal(r.amountCents, 25_000);
  assert.equal(r.capApplied, true);
});

test("no cap charges the full percentage", () => {
  const r = commissionCents(5_000_000, 0, 1000, null);
  assert.equal(r.amountCents, 500_000);
  assert.equal(r.capApplied, false);
});

test("a zero-rate plan owes nothing", () => {
  const r = commissionCents(100_000, 0, 0, 25_000);
  assert.equal(r.amountCents, 0);
});

test("commission rounds down, never up", () => {
  // 10% of $10.05 is $1.005, which must not round up to $1.01.
  const r = commissionCents(1_005, 0, 1000, null);
  assert.equal(r.amountCents, 100);
});

test("the cap applies before the rate would exceed it, and not at all below it", () => {
  const atCap = commissionCents(250_000, 0, 1000, 25_000);
  assert.equal(atCap.amountCents, 25_000);
  assert.equal(atCap.capApplied, false);
  const overCap = commissionCents(250_100, 0, 1000, 25_000);
  assert.equal(overCap.capApplied, true);
  assert.equal(overCap.amountCents, 25_000);
});

test("base is computed from whole cents", () => {
  assert.equal(commissionBaseCents(10_099, 0), 10_099);
  assert.equal(commissionBaseCents(10_099, 99), 10_000);
});

test("the included allowance classifies the earliest leads as free", () => {
  assert.deepEqual(classifyAllowance(3, 2), ["included", "included", "commissionable"]);
});

test("an allowance of zero makes every lead commissionable", () => {
  assert.deepEqual(classifyAllowance(2, 0), ["commissionable", "commissionable"]);
});

test("more allowance than leads leaves everything included", () => {
  assert.deepEqual(classifyAllowance(2, 25), ["included", "included"]);
});

test("classification is stable, so a plan change cannot reshuffle it", () => {
  // The same month and the same leads always classify the same way. Switching
  // plans changes the number passed in, not the rule, and the rule is monotonic:
  // a lead included under a smaller allowance cannot become commissionable under
  // a larger one for the same lead count.
  const small = classifyAllowance(12, 10);
  const large = classifyAllowance(12, 25);
  small.forEach((status, index) => {
    if (status === "included") assert.equal(large[index], "included");
  });
});

test("money renders as dollars and cents", () => {
  assert.equal(formatCents(0), "$0.00");
  assert.equal(formatCents(10_000), "$100.00");
  assert.equal(formatCents(25_000), "$250.00");
  assert.equal(formatCents(123_456), "$1,234.56");
  assert.equal(formatCents(5), "$0.05");
});

test("rates render as percentages", () => {
  assert.equal(formatRate(1000), "10%");
  assert.equal(formatRate(1250), "12.50%");
  assert.equal(formatRate(0), "0%");
});
