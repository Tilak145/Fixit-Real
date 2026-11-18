/**
 * A homeowner's budget on the phone, mirroring the website.
 *
 * The budget is the one number that tells a professional whether a job is worth
 * an afternoon, so the phone asks for it too. It is optional: "not sure" is a
 * real answer and leaves the range empty.
 *
 * This module has no imports, so it can be tested by Node directly.
 */

export interface BudgetRange {
  minCents: number | null;
  maxCents: number | null;
}

export interface BudgetPreset {
  id: string;
  label: string;
  minDollars: number;
  maxDollars: number | null;
}

export const BUDGET_PRESETS: BudgetPreset[] = [
  { id: 'under-250', label: 'Under $250', minDollars: 0, maxDollars: 250 },
  { id: '250-500', label: '$250 - $500', minDollars: 250, maxDollars: 500 },
  { id: '500-1000', label: '$500 - $1,000', minDollars: 500, maxDollars: 1_000 },
  { id: '1000-2500', label: '$1,000 - $2,500', minDollars: 1_000, maxDollars: 2_500 },
  { id: '2500-plus', label: '$2,500 or more', minDollars: 2_500, maxDollars: null },
];

export function presetRange(id: string): BudgetRange {
  const preset = BUDGET_PRESETS.find(p => p.id === id);
  if (!preset) return { minCents: null, maxCents: null };
  return {
    minCents: preset.minDollars * 100,
    maxCents: preset.maxDollars == null ? null : preset.maxDollars * 100,
  };
}

export function parseDollarsToCents(input: string | null | undefined): number | null {
  if (input == null) return null;
  const cleaned = input.replace(/[^0-9.]/g, '').trim();
  if (cleaned === '') return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

export function formatCents(cents: number | null | undefined): string {
  if (cents == null) return '-';
  return '$' + Math.round(cents / 100).toLocaleString('en-US');
}

export function formatBudgetRange(range: BudgetRange | null | undefined): string {
  if (!range || (range.minCents == null && range.maxCents == null)) return 'Budget not given';
  const { minCents, maxCents } = range;
  if (minCents != null && maxCents != null) return formatCents(minCents) + ' to ' + formatCents(maxCents);
  if (maxCents != null) return 'Up to ' + formatCents(maxCents);
  return formatCents(minCents) + ' or more';
}

export function validateBudgetRange(minCents: number | null, maxCents: number | null): string | null {
  if (minCents != null && maxCents != null && maxCents < minCents) {
    return 'The highest amount should be at least as much as the lowest.';
  }
  return null;
}

