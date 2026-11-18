/**
 * Comparing quotes on the phone, with the same rules the website uses.
 *
 * The breakdown is what makes two prices comparable: labour-only and all-in are
 * different offers, and a single number hides that. This mirrors the website's
 * logic so a customer sees the same facts on either — the totals, the terms,
 * and the gaps worth asking about before choosing.
 */

export interface QuoteBreakdownInput {
  amount_cents: number;
  labour_cents?: number | null;
  materials_cents?: number | null;
  service_call_cents?: number | null;
  emergency_fee_cents?: number | null;
  other_cents?: number | null;
  other_label?: string | null;
  earliest_start?: string | null;
  completion_note?: string | null;
  warranty?: string | null;
  payment_terms?: string | null;
  valid_until?: string | null;
}

export interface QuoteLine {
  key: 'labour' | 'materials' | 'serviceCall' | 'emergency' | 'other';
  label: string;
  cents: number;
}

/** The parts of a quote that are actually charged, in reading order. */
export function quoteLines(quote: QuoteBreakdownInput): QuoteLine[] {
  const rows: QuoteLine[] = [
    { key: 'labour', label: 'Labour', cents: quote.labour_cents ?? 0 },
    { key: 'materials', label: 'Materials', cents: quote.materials_cents ?? 0 },
    { key: 'serviceCall', label: 'Service call', cents: quote.service_call_cents ?? 0 },
    { key: 'emergency', label: 'Emergency fee', cents: quote.emergency_fee_cents ?? 0 },
    { key: 'other', label: quote.other_label?.trim() || 'Other', cents: quote.other_cents ?? 0 },
  ];
  return rows.filter(row => row.cents > 0);
}

export function partsMatchTotal(quote: QuoteBreakdownInput): boolean {
  return quoteLines(quote).reduce((total, line) => total + line.cents, 0) === quote.amount_cents;
}

/** The things a customer should ask about before choosing, as plain questions. */
export function quoteGaps(quote: QuoteBreakdownInput): string[] {
  const gaps: string[] = [];
  if ((quote.materials_cents ?? 0) === 0) gaps.push('Materials are not included — ask who supplies the parts.');
  if (!quote.earliest_start) gaps.push('No start date given.');
  if (!quote.completion_note?.trim()) gaps.push('No estimate of how long the job will take.');
  if (!quote.warranty?.trim()) gaps.push('No warranty stated.');
  if (!quote.payment_terms?.trim()) gaps.push('No payment terms stated.');
  if (!partsMatchTotal(quote)) gaps.push('The parts do not add up to the total — ask for a corrected quote.');
  return gaps;
}

export function validity(quote: QuoteBreakdownInput, now: Date): 'none' | 'valid' | 'expired' {
  if (!quote.valid_until) return 'none';
  // A bare date parses as midnight UTC, which is the previous evening anywhere
  // west of UTC. Read it as a local date so the last day is the day written.
  const until = new Date(
    /^\d{4}-\d{2}-\d{2}$/u.test(quote.valid_until) ? `${quote.valid_until}T00:00:00` : quote.valid_until,
  );
  if (Number.isNaN(until.getTime())) return 'none';
  // The date is inclusive: a quote valid until today is good all day.
  const endOfDay = new Date(until);
  endOfDay.setHours(23, 59, 59, 999);
  return now.getTime() <= endOfDay.getTime() ? 'valid' : 'expired';
}

/** Formats a quote amount for display, in whole cents. */
export function formatQuoteCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const value = Math.abs(Math.round(cents));
  return sign + '$' + Math.floor(value / 100).toLocaleString() + '.' + String(value % 100).padStart(2, '0');
}
