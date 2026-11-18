/**
 * The city a customer is shopping in. The owner keeps one list of served cities;
 * this decides which of them applies: the one the customer chose before, else the
 * first the owner offers. A remembered value that is no longer on the list is
 * ignored, so a stale choice can never name a city FixIt does not cover.
 */
export function resolveCity(active: string[], remembered: string | null | undefined): string | null {
  if (active.length === 0) return null;
  if (remembered && active.includes(remembered)) return remembered;
  return active[0];
}

export const CITY_STORAGE_KEY = 'fixit.city';
