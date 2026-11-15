import type { MyRequest } from "./fixit.ts";

export interface WaitingQuotes {
  count: number;
  /** The newest waiting price, for a one-line summary. */
  latest: { providerName: string | null; amountCents: number; verified: boolean } | null;
}

/**
 * Prices a customer has been sent and has not answered yet. A price is waiting
 * while it is "sent" on a request that is still open; once the customer picks
 * one, the others close and stop counting.
 */
export function countWaitingQuotes(requests: MyRequest[]): WaitingQuotes {
  const waiting = requests
    .filter((request) => request.status !== "completed")
    .flatMap((request) => request.quotes ?? [])
    .filter((quote) => quote.status === "sent");
  const newest = [...waiting].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  return {
    count: waiting.length,
    latest: newest
      ? {
          providerName: newest.provider_name ?? null,
          amountCents: newest.amount_cents,
          verified: Boolean(newest.provider_verified),
        }
      : null,
  };
}
