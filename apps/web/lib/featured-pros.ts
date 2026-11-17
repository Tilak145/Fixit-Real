/**
 * Who gets the featured spots on the home page.
 *
 * The spots go to the plans that pay the most: Business first, then
 * Professional. Starter and the free Founding plan are never featured. Within a
 * plan, the order the list already has is kept (who can help soonest, then
 * rating), so a Business pro is always above a Professional one, and equals are
 * ranked the way a customer would rank them. A pro who has switched off new work
 * is not featured: a prominent spot for someone who is not taking jobs would
 * waste the customer's time and the pro's money.
 */

/** How many featured spots the home page has. */
export const FEATURED_SLOTS = 4;

/** Lower is better. null means the plan is not featured. */
export function featuredTier(plan: string | null | undefined): number | null {
  if (plan === "business") return 0;
  if (plan === "professional") return 1;
  return null;
}

export function pickFeatured<T extends { plan?: string | null; acceptingWork?: boolean }>(
  pros: T[],
  slots: number = FEATURED_SLOTS,
): T[] {
  return pros
    .filter((pro) => featuredTier(pro.plan) !== null && pro.acceptingWork !== false)
    .map((pro, order) => ({ pro, order }))
    .sort((a, b) => (featuredTier(a.pro.plan)! - featuredTier(b.pro.plan)!) || a.order - b.order)
    .slice(0, slots)
    .map((entry) => entry.pro);
}
