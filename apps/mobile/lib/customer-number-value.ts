/** FixIt customer numbers are always six digits, as issued by the database. */
const MIN = 100_000;
const MAX = 999_999;

/** A stored value as a six-digit customer number, or null if it is not one. */
export function asCustomerNumber(value: unknown): number | null {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof number !== 'number' || !Number.isInteger(number)) return null;
  return number >= MIN && number <= MAX ? number : null;
}
