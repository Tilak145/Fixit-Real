import assert from "node:assert/strict";
import test from "node:test";
import type { MyRequest } from "./fixit.ts";
import { countWaitingQuotes } from "./waiting-quotes-count.ts";

const quote = (status: string, created_at: string, name: string, cents: number) =>
  ({ status, created_at, provider_name: name, amount_cents: cents, provider_verified: true });

const request = (status: string, quotes: unknown[]) => ({ status, quotes }) as unknown as MyRequest;

test("counts only sent prices on open requests", () => {
  const result = countWaitingQuotes([
    request("new", [quote("sent", "2026-11-15T10:00:00Z", "A", 10000), quote("declined", "2026-11-15T09:00:00Z", "B", 5000)]),
    request("completed", [quote("sent", "2026-11-14T10:00:00Z", "C", 7000)]),
    request("claimed", []),
  ]);
  assert.equal(result.count, 1);
  assert.equal(result.latest?.providerName, "A");
  assert.equal(result.latest?.amountCents, 10000);
});

test("nothing waiting gives zero and no summary", () => {
  const result = countWaitingQuotes([]);
  assert.equal(result.count, 0);
  assert.equal(result.latest, null);
});
