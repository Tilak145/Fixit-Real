/**
 * What a pro has earned through FixIt, worked out from rows they can already
 * see. FixIt does not take the customer's payment, so these are the prices
 * customers accepted and the job values the pro reported, never money received.
 * Free of imports so the arithmetic can be tested directly.
 */

export interface AcceptedQuote {
  amount_cents: number;
  /** When the customer accepted. */
  responded_at: string | null;
}

export interface CompletedJob {
  job_subtotal_cents: number;
  refunded_cents: number;
  completed_on: string | null;
  verification_status: "pending" | "verified" | "disputed" | "rejected";
}

export interface Earnings {
  /** Accepted prices, this calendar month. */
  bookedThisMonthCents: number;
  bookedThisMonthCount: number;
  /** Accepted prices, since the pro joined. */
  bookedAllTimeCents: number;
  bookedAllTimeCount: number;
  /** Completed jobs FixIt confirmed, after refunds. */
  confirmedCents: number;
  confirmedCount: number;
  /** Completed jobs reported but not yet confirmed. */
  awaitingCents: number;
  awaitingCount: number;
}

function sameMonth(iso: string | null, now: Date): boolean {
  if (!iso) return false;
  const at = new Date(iso);
  return at.getFullYear() === now.getFullYear() && at.getMonth() === now.getMonth();
}

export function summarizeEarnings(quotes: AcceptedQuote[], jobs: CompletedJob[], now: Date): Earnings {
  const month = quotes.filter((quote) => sameMonth(quote.responded_at, now));
  const net = (job: CompletedJob) => Math.max(0, job.job_subtotal_cents - job.refunded_cents);
  const confirmed = jobs.filter((job) => job.verification_status === "verified");
  const awaiting = jobs.filter((job) => job.verification_status === "pending");
  const sum = <T,>(rows: T[], pick: (row: T) => number) => rows.reduce((total, row) => total + pick(row), 0);
  return {
    bookedThisMonthCents: sum(month, (quote) => quote.amount_cents),
    bookedThisMonthCount: month.length,
    bookedAllTimeCents: sum(quotes, (quote) => quote.amount_cents),
    bookedAllTimeCount: quotes.length,
    confirmedCents: sum(confirmed, net),
    confirmedCount: confirmed.length,
    awaitingCents: sum(awaiting, net),
    awaitingCount: awaiting.length, 
  };
}
