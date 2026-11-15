import assert from "node:assert/strict";
import test from "node:test";
import { summarizeEarnings } from "./earnings.ts";

const now = new Date("2026-11-15T12:00:00Z");

test("adds accepted prices, splitting this month from all time", () => {
  const e = summarizeEarnings(
    [
      { amount_cents: 20000, responded_at: "2026-11-02T10:00:00Z" },
      { amount_cents: 15000, responded_at: "2026-10-20T10:00:00Z" },
    ],
    [],
    now,
  );
  assert.equal(e.bookedThisMonthCents, 20000);
  assert.equal(e.bookedThisMonthCount, 1);
  assert.equal(e.bookedAllTimeCents, 35000);
  assert.equal(e.bookedAllTimeCount, 2);
});

test("only confirmed jobs count as confirmed, and refunds come off", () => {
  const e = summarizeEarnings(
    [],
    [
      { job_subtotal_cents: 50000, refunded_cents: 10000, completed_on: null, verification_status: "verified" },
      { job_subtotal_cents: 30000, refunded_cents: 0, completed_on: null, verification_status: "pending" },
      { job_subtotal_cents: 99999, refunded_cents: 0, completed_on: null, verification_status: "rejected" },
    ],
    now,
  );
  assert.equal(e.confirmedCents, 40000);
  assert.equal(e.awaitingCents, 30000);
  assert.equal(e.confirmedCount, 1);
  assert.equal(e.awaitingCount, 1);
});
