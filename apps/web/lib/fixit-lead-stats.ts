/**
 * What a professional's leads actually turned into.
 *
 * The marketplaces this product competes with advertise an average win rate the
 * individual contractor cannot check. The honest alternative is to count the
 * contractor's own leads: how many reached them, how many they priced, how many
 * customers chose them, and how many jobs finished. Every number here is
 * counted from rows the professional can see, so it is their record, not a
 * claim about the market.
 *
 * This module has no imports, so it can be tested by Node directly.
 */

export interface FunnelLead {
  /** The pro holds this lead (the customer chose them). */
  claimedByMe: boolean;
  /** The pro has sent a price on this lead. */
  quotedByMe: boolean;
  /** The job is closed. */
  completed: boolean;
}

export interface LeadFunnel {
  matched: number;
  quoted: number;
  won: number;
  completed: number;
  /** Quoted / matched, as a whole percent. Null when nothing matched. */
  quoteRatePct: number | null;
  /** Won / quoted, as a whole percent. Null when nothing was quoted. */
  winRatePct: number | null;
}

function pct(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  return Math.round((part / whole) * 100);
}

export function leadFunnel(leads: FunnelLead[]): LeadFunnel {
  const matched = leads.length;
  const quoted = leads.filter((l) => l.quotedByMe).length;
  const won = leads.filter((l) => l.claimedByMe).length;
  const completed = leads.filter((l) => l.claimedByMe && l.completed).length;
  return {
    matched,
    quoted,
    won,
    completed,
    quoteRatePct: pct(quoted, matched),
    winRatePct: pct(won, quoted),
  };
}

/** A plain sentence for the dashboard, honest about small numbers. */
export function formatFunnel(funnel: LeadFunnel): string {
  if (funnel.matched === 0) {
    return "No leads have reached you yet. When a matching request comes in, it shows up in your list.";
  }
  if (funnel.quoted === 0) {
    return funnel.matched + " lead" + (funnel.matched === 1 ? "" : "s") + " reached you. Send a price on one to start your record.";
  }
  const win = funnel.winRatePct ?? 0;
  return (
    "You priced " +
    funnel.quoted +
    " of " +
    funnel.matched +
    " leads, and customers chose you on " +
    funnel.won +
    " of the " +
    funnel.quoted +
    " you priced (" +
    win +
    "%)."
  );
}

