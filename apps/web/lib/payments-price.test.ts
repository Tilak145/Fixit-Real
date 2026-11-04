import { test } from "node:test";
import assert from "node:assert/strict";

import { currentPrice, type SellablePrice } from "./payments-price.ts";

function price(id: string, unitAmount: number, extra: Partial<SellablePrice> = {}): SellablePrice {
  return {
    id,
    unitAmount,
    entitlementKey: "starter",
    active: true,
    ...extra,
  };
}

test("no prices means nothing to sell", () => {
  assert.equal(currentPrice(undefined), undefined);
  assert.equal(currentPrice([]), undefined);
});

test("a price change sells the newest price, not the first listed", () => {
  const oldPrice = price("old-49", 4900);
  const newPrice = { ...price("new-99", 9900), createdAt: "2026-11-01T05:24:55Z" } as SellablePrice;
  assert.equal(currentPrice([newPrice, oldPrice])?.id, "new-99");
});

test("without a creation date the highest amount wins, never a lower one", () => {
  assert.equal(currentPrice([price("old-49", 4900), price("new-99", 9900)])?.id, "new-99");
});

test("inactive prices are never sold", () => {
  const live = price("live", 9900);
  const retired = { ...price("retired", 4900), active: false };
  assert.equal(currentPrice([retired, live])?.id, "live");
});
