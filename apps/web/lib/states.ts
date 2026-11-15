/**
 * Everything that differs from one state to the next, in one place.
 *
 * TO ADD A STATE: add one entry to STATES below (copy the Ohio one), then add
 * that state's cities in the admin screen. Nothing else in the code changes.
 *
 *   licenseLookupUrl       the state's contractor / trade licence search
 *   registrationLookupUrl  the state's business register (Secretary of State)
 *   registrationName       what that register is called, for the sign-up text
 *   licenseFormat          what a licence number looks like, if the state has a
 *                          fixed shape. Leave it out and any 4-24 letters or
 *                          digits is accepted.
 *   timezone               the state's main time zone (see the note in
 *                          fixit-live-availability.ts: opening hours still use
 *                          one site-wide zone today).
 *
 * The web addresses must be checked by a person when a state is added: states
 * move their search pages from time to time.
 */
export interface StateInfo {
  code: string;
  name: string;
  licenseLookupUrl: string;
  registrationLookupUrl: string;
  registrationName: string;
  licenseFormat?: RegExp;
  timezone: string;
}

export const STATES: Record<string, StateInfo> = {
  OH: {
    code: "OH",
    name: "Ohio",
    licenseLookupUrl: "https://elicense.ohio.gov/",
    registrationLookupUrl: "https://businesssearch.ohiosos.gov/",
    registrationName: "Ohio Secretary of State",
    timezone: "America/New_York",
  },
};

export const DEFAULT_STATE = "OH";

/** The settings for a two-letter state code, falling back to the home state. */
export function stateInfo(code: string | null | undefined): StateInfo {
  return STATES[(code ?? "").trim().toUpperCase()] ?? STATES[DEFAULT_STATE];
}

/** True when this state has its own entry (so its links are really its own). */
export function isKnownState(code: string | null | undefined): boolean {
  return Boolean(STATES[(code ?? "").trim().toUpperCase()]);
}

/** The state in an address or city label such as "Akron, OH 44308"; null when none is written. */
export function stateFromAddress(address: string | null | undefined): string | null {
  const matches = [...(address ?? "").matchAll(/,\s*([A-Za-z]{2})(?=\s*\d{5}|\s*$|,)/gu)];
  const last = matches.at(-1)?.[1];
  return last ? last.toUpperCase() : null;
}

/** Whether a licence number has an acceptable shape for the state. */
export function licenseNumberLooksValid(code: string | null | undefined, licenseNumber: string): boolean {
  const value = licenseNumber.trim();
  const format = stateInfo(code).licenseFormat;
  return format ? format.test(value) : /^[A-Za-z0-9-]{4,24}$/u.test(value);
}
