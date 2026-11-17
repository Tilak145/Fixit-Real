/**
 * Ordering and paging a city's professionals for a service.
 *
 * Everything who-comes-first lives here, separate from the database reads, so
 * it can be tested and so the list can be ranked in full before it is cut.
 * The old list took the 24 best-rated professionals and only then applied
 * paid placement, so a paying professional with no reviews never made the cut.
 * Now every match is ranked first and the page is taken from the ranked list.
 *
 * The rule itself is unchanged: whoever can help soonest comes first, then
 * whoever paid for a higher placement, then the better rating.
 */

import {
  compareByAvailability,
  matchesAvailabilityFilter,
  type AvailabilityFacts,
  type AvailabilityFilter,
} from "./fixit-live-availability.ts";

/** How many professionals one "page" of a service list holds. */
export const PAGE_SIZE = 12;

/** The most pages a visitor can open, so a mistyped link cannot ask for everything. */
export const MAX_PAGES = 50;

/**
 * The search placement a plan buys; lower comes first. It matches
 * plan_entitlements in the database, which is the authority.
 */
export function placementForPlan(plan: string | null | undefined): number {
  if (plan === "business") return 10;
  if (plan === "professional" || plan === "founding") return 20;
  return 30;
}

export interface Rankable {
  facts: AvailabilityFacts;
  rating: number;
  placement: number;
}

/** Every professional ranked the way a customer would rank them. Does not change its input. */
export function rankPros<T extends Rankable>(pros: T[], now: Date): T[] {
  return [...pros].sort((a, b) => compareByAvailability(a, b, now));
}

export const FILTER_KEYS: AvailabilityFilter[] = ["any", "today", "tomorrow", "emergency"];

/** How many professionals fit each availability filter, over the whole list. */
export function countByFilter<T extends { facts: AvailabilityFacts }>(
  pros: T[],
  now: Date,
): Record<AvailabilityFilter, number> {
  const counts: Record<AvailabilityFilter, number> = { any: 0, today: 0, tomorrow: 0, emergency: 0 };
  for (const key of FILTER_KEYS) {
    counts[key] = pros.filter((pro) => matchesAvailabilityFilter(pro.facts, key, now)).length;
  }
  return counts;
}

/** A filter named in a link, or "any" when it is missing or not one of ours. */
export function parseFilter(value: string | null | undefined): AvailabilityFilter {
  return FILTER_KEYS.includes(value as AvailabilityFilter) ? (value as AvailabilityFilter) : "any";
}

/** A page number named in a link, kept to 1..MAX_PAGES. */
export function parsePage(value: string | null | undefined): number {
  const page = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(page) || page < 1) return 1;
  return Math.min(page, MAX_PAGES);
}

/**
 * The first `page` pages of a ranked list: page 2 is the first 24, not just
 * items 13 to 24, so "Show more" adds to what the visitor already sees.
 */
export function takePages<T>(ranked: T[], page: number, pageSize: number = PAGE_SIZE): { items: T[]; hasMore: boolean } {
  const count = Math.max(1, page) * pageSize;
  return { items: ranked.slice(0, count), hasMore: ranked.length > count };
}
