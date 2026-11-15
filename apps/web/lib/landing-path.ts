/**
 * Where someone goes right after signing in.
 *
 * A professional belongs on their dashboard, not on the customer home page.
 * The page they asked for still wins: the pro sign-up flow, for example, sends
 * people to /pro/onboarding on purpose, and that must not be overridden.
 * Only the plain "/" (nothing in particular was asked for) is replaced.
 *
 * This module has no imports, so it can be tested by Node directly.
 */

export const PRO_HOME = "/pro/dashboard";

export function landingFor(requested: string | null | undefined, isPro: boolean): string {
  const asked = requested && requested.length > 0 ? requested : "/";
  return asked === "/" && isPro ? PRO_HOME : asked;
}
