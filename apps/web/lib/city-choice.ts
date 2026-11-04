/**
 * The city a visitor is shopping in.
 *
 * The owner keeps one list of served cities, and both sides of the marketplace
 * pick from it. This module decides which of those cities applies to a visitor,
 * and remembers their choice, so "I am in Kent" survives moving from the home
 * page to a service page and back.
 *
 * The rule, most specific first: a city named in the URL wins, because a shared
 * link should show what it promised; then the city the visitor chose before;
 * then the first city the owner offers. A value that is not in the served list
 * is ignored, so a stale or hand-edited value can never name a city FixIt does
 * not actually cover.
 *
 * The pure decision has no imports, so it can be tested by Node directly; the
 * two storage helpers are guarded for the server, where window does not exist.
 */

export const CITY_STORAGE_KEY = "fixit:city";

export function resolveCity(
  active: string[],
  param: string | null | undefined,
  remembered: string | null | undefined,
): string | null {
  if (active.length === 0) return null;
  if (param && active.includes(param)) return param;
  if (remembered && active.includes(remembered)) return remembered;
  return active[0];
}

/** The city the visitor chose on a previous visit, or null. */
export function readRememberedCity(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(CITY_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Remember the visitor's city so the header and the home page agree next time. */
export function rememberCity(label: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CITY_STORAGE_KEY, label);
  } catch {
    // A browser with storage disabled still works; the choice just is not kept.
  }
}

