/**
 * Who gets the featured spots on the home page.
 *
 * The spots go to the plans that pay the most: Business first, then
 * Professional. Starter and the free Founding plan are never featured. A pro who
 * has switched off new work is not featured: a prominent spot for someone who is
 * not taking jobs would waste the customer's time and the pro's money.
 *
 * Within the same plan, those who can help right now come before those who
 * cannot, and professionals who are equal on both take turns: the order is
 * shuffled with a seed that changes every half hour. Without that, the same few
 * professionals would hold every spot every day and the rest, paying the same,
 * would never be seen. The seed is stable inside the half hour, so the page does
 * not reshuffle itself while someone is reading it.
 */

import {
  availabilityState,
  type AvailabilityFacts,
} from "./fixit-live-availability.ts";
import type { AvailabilityWindow } from "./fixit-availability.ts";

/** How many featured spots the home page has. */
export const FEATURED_SLOTS = 4;

/** How long one turn of the featured spots lasts. */
export const TURN_MINUTES = 30;

/** Lower is better. null means the plan is not featured. */
export function featuredTier(plan: string | null | undefined): number | null {
  if (plan === "business") return 0;
  if (plan === "professional") return 1;
  return null;
}

/** The seed for the current turn in a city; it changes every TURN_MINUTES. */
export function featuredSeed(now: Date, city: string | null | undefined): string {
  return `${Math.floor(now.getTime() / (TURN_MINUTES * 60_000))}|${city ?? ""}`;
}

export interface FeaturedCandidate {
  id?: string;
  plan?: string | null;
  acceptingWork?: boolean;
  acceptsEmergency?: boolean;
  hours?: AvailabilityWindow[];
}

function hashSeed(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** A small seeded random number generator, so a turn's order is repeatable. */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: T[], seed: string): T[] {
  const random = seededRandom(hashSeed(seed));
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function factsOf(pro: FeaturedCandidate): AvailabilityFacts {
  return {
    acceptingWork: pro.acceptingWork ?? true,
    acceptsEmergency: Boolean(pro.acceptsEmergency),
    windows: pro.hours ?? [],
  };
}

/**
 * The featured professionals, in order. With a `seed`, equals take turns; without
 * one they keep the order they arrived in.
 */
export function pickFeatured<T extends FeaturedCandidate>(
  pros: T[],
  options: { slots?: number; seed?: string; now?: Date } = {},
): T[] {
  const slots = options.slots ?? FEATURED_SLOTS;
  const now = options.now ?? new Date();
  // Group by plan, then by whether they can help right now.
  const groups = new Map<string, T[]>();
  for (const pro of pros) {
    const tier = featuredTier(pro.plan);
    if (tier === null || pro.acceptingWork === false) continue;
    const bucket = availabilityState(factsOf(pro), now) === "available" ? 0 : 1;
    const key = `${tier}.${bucket}`;
    groups.set(key, [...(groups.get(key) ?? []), pro]);
  }
  const ordered: T[] = [];
  for (const key of [...groups.keys()].sort()) {
    const group = groups.get(key)!;
    ordered.push(...(options.seed === undefined ? group : shuffled(group, `${options.seed}|${key}`)));
  }
  return ordered.slice(0, slots);
}
