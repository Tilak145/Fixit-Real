/**
 * Comparing quotes, in one place.
 *
 * The point of a breakdown is that two prices are rarely the same job. One
 * professional quotes labour only and expects the customer to supply the parts;
 * another bundles everything and adds an after-hours fee. Put next to each
 * other as a single number, the cheaper one looks better and may not be, so the
 * comparison has to show what each price is made of and what it does not cover.
 *
 * Nothing here decides for the customer. It orders the quotes by what they cost
 * once the parts are counted, flags the gaps worth asking about, and lets the
 * screen state the differences in plain words. Keeping it free of anything a
 * browser provides means the ordering and the totals can be tested directly.
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
  key: "labour" | "materials" | "serviceCall" | "emergency" | "other";
  label: string;
  cents: number;
}

/** The parts of a quote that are actually charged, in reading order. */
export function quoteLines(quote: QuoteBreakdownInput): QuoteLine[] {
  const rows: QuoteLine[] = [
    { key: "labour", label: "Labour", cents: quote.labour_cents ?? 0 },
    { key: "materials", label: "Materials", cents: quote.materials_cents ?? 0 },
    { key: "serviceCall", label: "Service call", cents: quote.service_call_cents ?? 0 },
    { key: "emergency", label: "Emergency fee", cents: quote.emergency_fee_cents ?? 0 },
    {
      key: "other",
      label: quote.other_label?.trim() || "Other",
      cents: quote.other_cents ?? 0,
    },
  ];
  return rows.filter((row) => row.cents > 0);
}

/**
 * Whether the parts add up to the total. The database refuses a quote that does
 * not, so this should always hold; the comparison checks anyway, because a
 * missing part is exactly the thing a customer must not be shown as a bargain.
 */
export function partsMatchTotal(quote: QuoteBreakdownInput): boolean {
  const sum = quoteLines(quote).reduce((total, line) => total + line.cents, 0);
  return sum === quote.amount_cents;
}

/**
 * The things a customer should ask about before choosing, phrased as questions.
 * These are gaps, not faults: quoting labour alone is a legitimate way to work,
 * it just is not the same offer as an all-in price.
 */
export function quoteGaps(quote: QuoteBreakdownInput): string[] {
  const gaps: string[] = [];
  if ((quote.materials_cents ?? 0) === 0) {
    gaps.push("Materials are not included — ask who supplies the parts.");
  }
  if (!quote.earliest_start) {
    gaps.push("No start date given.");
  }
  if (!quote.completion_note?.trim()) {
    gaps.push("No estimate of how long the job will take.");
  }
  if (!quote.warranty?.trim()) {
    gaps.push("No warranty stated.");
  }
  if (!quote.payment_terms?.trim()) {
    gaps.push("No payment terms stated.");
  }
  if (!partsMatchTotal(quote)) {
    gaps.push("The parts do not add up to the total — ask for a corrected quote.");
  }
  return gaps;
}

/**
 * When a quote stops being valid: the date it was given for, or null when the
 * professional set none. An expired quote is not hidden — the customer may
 * still accept it — but the screen says so, because prices move.
 */
export function validity(quote: QuoteBreakdownInput, now: Date): "none" | "valid" | "expired" {
  if (!quote.valid_until) return "none";
  // A bare date parses as midnight UTC, which is the previous evening anywhere
  // west of UTC. Read it as a local date so the last day is the day written.
  const until = new Date(
    /^\d{4}-\d{2}-\d{2}$/u.test(quote.valid_until) ? `${quote.valid_until}T00:00:00` : quote.valid_until,
  );
  if (Number.isNaN(until.getTime())) return "none";
  // The date is inclusive: a quote valid until today is good all day.
  const endOfDay = new Date(until);
  endOfDay.setHours(23, 59, 59, 999);
  return now.getTime() <= endOfDay.getTime() ? "valid" : "expired";
}

/**
 * What differs between the quotes on one job, in the order a homeowner would
 * weigh it: the total, then the parts, then the terms. Each row names what is
 * being compared and gives one value per quote, so the screen can show a table
 * instead of asking the customer to diff the cards themselves.
 */
export interface ComparisonRow {
  label: string;
  /** One entry per quote, in the same order as the quotes passed in. */
  values: string[];
  /** True when the quotes genuinely differ on this row, so it can be highlighted. */
  differs: boolean;
}

export function comparisonRows(
  quotes: Array<QuoteBreakdownInput & { provider_name?: string | null }>,
  format: (cents: number) => string,
  now: Date = new Date(),
): ComparisonRow[] {
  if (quotes.length === 0) return [];
  const valuesFor = (read: (quote: QuoteBreakdownInput) => string): string[] => quotes.map(read);
  const row = (label: string, values: string[]): ComparisonRow => ({
    label,
    values,
    differs: new Set(values).size > 1,
  });

  const rows: ComparisonRow[] = [
    row("Total", valuesFor((q) => format(q.amount_cents))),
    row("Labour", valuesFor((q) => format(q.labour_cents ?? 0))),
    row("Materials", valuesFor((q) => format(q.materials_cents ?? 0))),
    row("Service call", valuesFor((q) => format(q.service_call_cents ?? 0))),
    row("Emergency fee", valuesFor((q) => format(q.emergency_fee_cents ?? 0))),
  ];
  // An "Other" line only earns a row when someone actually charged it, and it
  // carries its own label so the row name is honest about what it is.
  if (quotes.some((q) => (q.other_cents ?? 0) > 0)) {
    rows.push(
      row(
        "Other",
        valuesFor((q) => ((q.other_cents ?? 0) > 0 ? format(q.other_cents ?? 0) : "—")),
      ),
    );
  }
  rows.push(
    row("Earliest start", valuesFor((q) => q.earliest_start ?? "Not stated")),
    row("How long", valuesFor((q) => q.completion_note?.trim() || "Not stated")),
    row("Warranty", valuesFor((q) => q.warranty?.trim() || "Not stated")),
    row("Payment terms", valuesFor((q) => q.payment_terms?.trim() || "Not stated")),
    row(
      "Valid until",
      valuesFor((q) => {
        const state = validity(q, now);
        if (state === "none") return "No expiry given";
        return q.valid_until + (state === "expired" ? " · expired" : "");
      }),
    ),
  );
  return rows;
}
