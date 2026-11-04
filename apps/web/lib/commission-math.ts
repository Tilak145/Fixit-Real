/**
 * The commission and allowance arithmetic, with no imports at all.
 *
 * Kept separate from the database-facing module so it can be tested by Node
 * directly: a wrong commission is a charge a contractor will dispute, so the
 * calculation is the one part that must be provably right.
 */

export type AllowanceStatus = "included" | "commissionable";

/** A commission is charged on the subtotal after refunds, never including tax. */
export function commissionBaseCents(subtotalCents: number, refundedCents: number): number {
  return Math.max(Math.floor(subtotalCents) - Math.floor(refundedCents), 0);
}

/**
 * The commission owed on one completed job, in cents.
 *
 * rateBps is basis points (1000 = 10%). The cap, when set, is a ceiling on the
 * commission itself, not on the job value.
 */
export function commissionCents(
  subtotalCents: number,
  refundedCents: number,
  rateBps: number,
  capCents: number | null,
): { baseCents: number; amountCents: number; capApplied: boolean } {
  const baseCents = commissionBaseCents(subtotalCents, refundedCents);
  const raw = Math.floor((baseCents * rateBps) / 10000);
  const capApplied = capCents !== null && capCents !== undefined && raw > capCents;
  return { baseCents, amountCents: capApplied ? (capCents as number) : raw, capApplied };
}

/**
 * Which leads fall inside a contractor's included allowance for one month.
 * The earliest leads in the month are included; the rest are commissionable.
 * Given the same month and the same leads this always returns the same answer,
 * which is what stops a plan change from handing out a fresh allowance.
 */
export function classifyAllowance(count: number, includedLeads: number): AllowanceStatus[] {
  return Array.from({ length: count }, (_, index) =>
    index < Math.max(includedLeads, 0) ? "included" : "commissionable",
  );
}

/** Whole dollars from cents, for display: 10000 -> "$100.00". */
export function formatCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const value = Math.abs(Math.round(cents));
  return sign + "$" + Math.floor(value / 100).toLocaleString() + "." + String(value % 100).padStart(2, "0");
}

export function formatRate(bps: number): string {
  const percent = bps / 100;
  return (Number.isInteger(percent) ? percent : percent.toFixed(2)) + "%";
}
