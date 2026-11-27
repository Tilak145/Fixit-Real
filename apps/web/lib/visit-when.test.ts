import assert from "node:assert/strict";
import { test } from "node:test";
import { visitWhen } from "./visit-when.ts";

const now = new Date(2026, 10, 26, 22, 0);

test("a visit today says today", () => {
  assert.match(visitWhen(new Date(2026, 10, 26, 23, 30).toISOString(), now), /^Today at 11:30/);
});

test("a visit early tomorrow says tomorrow, even if only hours away", () => {
  assert.match(visitWhen(new Date(2026, 10, 27, 9, 0).toISOString(), now), /^Tomorrow at 9:00/);
});

test("a later visit names the day", () => {
  assert.match(visitWhen(new Date(2026, 11, 2, 14, 0).toISOString(), now), /^Wednesday, Dec 2 at 2:00/);
});

test("a bad date says nothing", () => {
  assert.equal(visitWhen("not a date", now), "");
});