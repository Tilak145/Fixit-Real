/**
 * A homeowner's budget — the range they are willing to spend on a job.
 *
 * A marketplace that hides the budget makes every professional guess, and the
 * guess shows up as a quote that was never going to be accepted. Asking up
 * front is not a commitment to spend: it is the one number that tells a
 * professional whether a job is worth their afternoon, and it is the filter
 * they most often ask for. The customer may also say "not sure", and then the
 * range is simply absent rather than zero.
 *
 * This module has no imports, so its arithmetic can be tested by Node directly.
 */

export interface BudgetRange {
  /** Cents, inclusive. Null means the customer set no floor. */
  minCents: number | null;
  /** Cents, inclusive. Null means the customer set no ceiling. */
  maxCents: number | null;
}

/** The preset bands offered in the form, in whole dollars. */
export interface BudgetPreset {
  id: string;
  label: string;
  minDollars: number;
  maxDollars: number | null;
}

export const BUDGET_PRESETS: BudgetPreset[] = [
  { id: "under-250", label: "Under $250", minDollars: 0, maxDollars: 250 },
  { id: "250-500", label: "$250 – $500", minDollars: 250, maxDollars: 500 },
  { id: "500-1000", label: "$500 – $1,000", minDollars: 500, maxDollars: 1_000 },
  { id: "1000-2500", label: "$1,000 – $2,500", minDollars: 1_000, maxDollars: 2_500 },
  { id: "2500-plus", label: "$2,500 or more", minDollars: 2_500, maxDollars: null },
];

/**
 * Parse a typed dollar string ("1,200", "$500", " 750 ") into cents. Returns
 * null for an empty or unreadable string, so a blank box stays a blank box
 * rather than becoming a budget of zero.
 */
export function parseDollarsToCents(input: string | null | undefined): number | null {
  if (input == null) return null;
  const cleaned = input.replace(/[^0-9.]/g, "").trim();
  if (cleaned === "") return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

/** Format cents as whole dollars for display ("$1,200"). Null becomes an em dash. */
export function formatCents(cents: number | null | undefined): string {
  if (cents == null) return "—";
  const dollars = Math.round(cents / 100);
  return "$" + dollars.toLocaleString("en-US");
}

/**
 * A short, plain phrase for the budget on a lead card, written for the
 * professional reading it. A missing range is honest, not blank: it says the
 * customer did not say.
 */
export function formatBudgetRange(range: BudgetRange | null | undefined): string {
  if (!range || (range.minCents == null && range.maxCents == null)) {
    return "Budget not given";
  }
  const { minCents, maxCents } = range;
  if (minCents != null && maxCents != null) {
    return formatCents(minCents) + " – " + formatCents(maxCents);
  }
  if (maxCents != null) return "Up to " + formatCents(maxCents);
  return formatCents(minCents) + " or more";
}

/**
 * Whether a budget overlaps a professional's preferred range. Used only client
 * side to filter a pro's own lead list, so it is deliberately lenient: an
 * unknown budget on either side matches rather than hiding a real job.
 */
export function budgetOverlaps(
  lead: BudgetRange | null | undefined,
  preferred: BudgetRange | null | undefined,
): boolean {
  const leadHas = !!lead && (lead.minCents != null || lead.maxCents != null);
  const prefHas = !!preferred && (preferred.minCents != null || preferred.maxCents != null);
  if (!leadHas || !prefHas) return true;
  const leadMin = lead!.minCents ?? 0;
  const leadMax = lead!.maxCents ?? Number.POSITIVE_INFINITY;
  const prefMin = preferred!.minCents ?? 0;
  const prefMax = preferred!.maxCents ?? Number.POSITIVE_INFINITY;
  return leadMin <= prefMax && prefMin <= leadMax;
}

/** Validate a two-ended range the customer typed. Returns an error message or null. */
export function validateBudgetRange(minCents: number | null, maxCents: number | null): string | null {
  if (minCents != null && maxCents != null && maxCents < minCents) {
    return "The highest amount should be at least as much as the lowest.";
  }
  return null;
}

