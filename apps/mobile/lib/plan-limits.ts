/**
 * How many cities and services a plan covers; null means no limit. The database
 * is the authority (plan_entitlements in the migrations) and refuses anything
 * over; these numbers must match it, so the app can say so before saving.
 */
export function planLimits(key: string): { cities: number | null; services: number | null } {
  if (key === 'business') return { cities: null, services: null };
  if (key === 'founding') return { cities: 2, services: 2 };
  if (key === 'professional') return { cities: 5, services: 3 };
  return { cities: 1, services: 2 };
}

const LABELS: Record<string, string> = {
  founding: 'Founding',
  starter: 'Starter',
  professional: 'Professional',
  business: 'Business',
};

/** What to tell a pro whose picks do not fit the plan, or null when they fit. */
export function planFitProblem(key: string, cityCount: number, serviceCount: number): string | null {
  const limits = planLimits(key);
  const overCities = limits.cities !== null && cityCount > limits.cities;
  const overServices = limits.services !== null && serviceCount > limits.services;
  if (!overCities && !overServices) return null;
  const count = (n: number, one: string, many: string) => n + ' ' + (n === 1 ? one : many);
  const picked = [
    overCities ? count(cityCount, 'city', 'cities') : null,
    overServices ? count(serviceCount, 'service', 'services') : null,
  ].filter(Boolean).join(' and ');
  return (
    (LABELS[key] ?? 'This plan') + ' covers ' + count(limits.cities ?? 0, 'city', 'cities') + ' and ' +
    count(limits.services ?? 0, 'service', 'services') + '. You picked ' + picked + '. Remove some, or choose a bigger plan on the website.'
  );
}