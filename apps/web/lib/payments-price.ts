/**
 * Which of a plan's prices is the one to sell.
 *
 * Stripe prices cannot be edited, so changing a plan's price adds a new price
 * and leaves the old one in place. Choosing "the first price" would then keep
 * selling the old amount, so this picks the newest one instead. It has no
 * imports, so it can be tested by Node directly.
 */

export interface SellablePrice {
  id: string;
  unitAmount: number;
  entitlementKey: string | null;
  active: boolean;
  createdAt?: string | null;
}

/**
 * A plan's price to sell. Stripe prices cannot be edited, so a price change adds
 * a new one and leaves the old active: pick by `createdAt` where the API sends
 * it, then the highest amount, so the newest price is the one charged.
 */
export function currentPrice(prices: SellablePrice[] | undefined): SellablePrice | undefined {
  if (!prices?.length) return undefined;
  const newest = prices.find((price) => price.active !== false && typeof price.createdAt === "string");
  if (newest) return newest;
  return [...prices].filter((price) => price.active !== false).sort((a, b) => b.unitAmount - a.unitAmount)[0];
}

