/** Money display helpers, with no imports. */

/** Whole dollars from cents, for display: 10000 -> "$100.00". */
export function formatCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const value = Math.abs(Math.round(cents));
  return sign + "$" + Math.floor(value / 100).toLocaleString() + "." + String(value % 100).padStart(2, "0");
}
