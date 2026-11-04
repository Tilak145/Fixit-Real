/**
 * How FixIt's numbers are written out.
 *
 * A nine-digit business number is hard to read and easy to get wrong on the
 * phone, so it is shown in groups of three ("304 215 887") everywhere it
 * appears — the pro's dashboard, the manager's table and the look-up. The
 * digits are the identity; the spaces are only for reading.
 */

/** "304215887" -> "304 215 887". Anything not nine digits is left alone. */
export function groupNumber(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 9) return value;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

/** What is typed or found, back to the number stored: strips spaces and dashes. */
export function digitsOf(value: string): string {
  return value.replace(/\D/g, "");
}
