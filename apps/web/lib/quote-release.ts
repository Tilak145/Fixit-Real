/**
 * When a professional may see the customer's phone, email and address.
 *
 * The rule is one sentence: the details are released when the customer accepts
 * the professional's price. The database enforces it; this module exists so the
 * screen shows the rule in the same terms, and so the rule itself is testable
 * without a running app.
 */

export type QuoteState = "none" | "sent" | "accepted" | "declined" | "withdrawn";

export function quoteState(quote: { status: string } | null | undefined): QuoteState {
  if (!quote) return "none";
  switch (quote.status) {
    case "sent":
    case "accepted":
    case "declined":
    case "withdrawn":
      return quote.status;
    default:
      return "none";
  }
}

export interface ReleaseInput {
  /** The state of this professional's quote on the lead. */
  status: string | null | undefined;
  /** Whether a live (not cancelled) visit is booked for the job. */
  hasAppointment?: boolean;
  /** Whether the request came from a guest, who has no account to accept a price. */
  guestRequest?: boolean;
  /** Whether the database actually handed back a contact detail. */
  hasContactOnFile?: boolean;
}

/**
 * Whether contact details are available for this lead.
 *
 * An accepted quote is the normal path. Two cases are already further along and
 * are released without one: a booked visit, because the two sides have agreed to
 * meet, and a guest request, because there is no customer account to answer a
 * price. A detail the database actually returned is always treated as released,
 * so the screen can never hide something it was allowed to show.
 */
export function contactDetailsReleased(input: ReleaseInput): boolean {
  if (input.hasContactOnFile) return true;
  if (input.status === "accepted") return true;
  if (input.hasAppointment || input.guestRequest) return true;
  return false;
}
