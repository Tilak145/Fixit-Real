/**
 * How many professionals stand behind each service on the home page.
 *
 * Two numbers, because they answer different questions. `total` is everyone
 * approved for the trade in the visitor's city. `availableNow` is the ones a
 * customer could actually reach this minute: accepting work, and inside the
 * hours they published for today. The card shows the second, so it never tells
 * a customer someone is available when they are not. A professional who has
 * published no hours is not counted as available: we cannot vouch for their day.
 */

import { availabilityState, type AvailabilityFacts } from "./fixit-live-availability.ts";

export interface CategoryProCount {
  total: number;
  availableNow: number;
}

export function countProsByCategory(
  services: { provider_id: string; category_slug: string }[],
  factsByProvider: Map<string, AvailabilityFacts>,
  now: Date,
): Record<string, CategoryProCount> {
  const availableIds = new Set<string>();
  for (const [id, facts] of factsByProvider) {
    if (availabilityState(facts, now) === "available") availableIds.add(id);
  }
  const counts: Record<string, CategoryProCount> = {};
  const seen = new Set<string>();
  for (const row of services) {
    // Only approved professionals in the chosen city are in the map.
    if (!factsByProvider.has(row.provider_id)) continue;
    const key = row.provider_id + "|" + row.category_slug;
    if (seen.has(key)) continue;
    seen.add(key);
    const entry = (counts[row.category_slug] ??= { total: 0, availableNow: 0 });
    entry.total += 1;
    if (availableIds.has(row.provider_id)) entry.availableNow += 1;
  }
  return counts;
}
