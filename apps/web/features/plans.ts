/**
 * The professional plans, in one place.
 *
 * These were duplicated in the sign-up wizard and the pro dashboard, which
 * meant the price a pro signed up for could drift from the one they later saw.
 * Everything that shows a plan reads it from here.
 *
 * Leads are framed as access in your area, never as a monthly quota. A new
 * marketplace cannot promise "30 leads a month" — there may not be 30 jobs in
 * that trade and city that month — and breaking that promise is what makes a
 * professional cancel. What the plan can honestly promise is visibility, speed
 * and tools, all of which the product controls.
 */
export type PlanKey = "founding" | "starter" | "professional" | "business";

export interface Plan {
  key: PlanKey;
  label: string;
  /** Monthly price in whole dollars; 0 for the free founding tier. */
  price: number;
  /** One line that says who this is for. */
  tagline: string;
  /** What the pro gets. Keep these deliverable. */
  features: string[];
  /** Highlight this tier in the sign-up grid. */
  recommended?: boolean;
  /** A short badge, e.g. the founding tier's limit. */
  badge?: string;
}

export const PLANS: Plan[] = [
  {
    key: "founding",
    label: "Founding Pro",
    price: 0,
    badge: "First 100 pros",
    tagline: "Your first month is free, then the plan you choose.",
    features: [
      "First month free, then $99–$399 a month",
      "Unlimited lead access in your area",
      "Your profile in search results",
      "Verified licence badge",
      "New leads appear in your dashboard instantly",
    ],
  },
  {
    key: "starter",
    label: "Starter",
    price: 99,
    tagline: "Get found by local customers.",
    features: [
      "Unlimited lead access in 1 city",
      "Offer up to 2 services",
      "Professional profile page",
      "Customer messages, quoting and scheduling",
      "Listed in customer search",
    ],
  },
  {
    key: "professional",
    label: "Professional",
    price: 199,
    tagline: "See jobs first and stand out in search.",
    recommended: true,
    features: [
      "Everything in Starter",
      "Search placement above Starter",
      "First look at new leads, before Starter",
      "Service area: up to 5 cities",
      "Offer up to 3 services",
    ],
  },
  {
    key: "business",
    label: "Business",
    price: 399,
    tagline: "For teams that want the top of the page.",
    features: [
      "Everything in Professional",
      "Top placement in customer search",
      "Unlimited cities and services",
      "First look at every new lead",
    ],
  },
];

export const PLAN_LABELS: Record<string, string> = Object.fromEntries(
  PLANS.map((plan) => [plan.key, plan.label]),
);

/** The paid tiers, in order; the founding tier is shown separately. */
export const PAID_PLANS = PLANS.filter((plan) => plan.price > 0);

/**
 * How many cities and services a plan covers; null means no limit. The database
 * is the authority (plan_entitlements in the migrations) and refuses anything
 * over; these numbers must match it, so the page can say so before saving.
 */
export function planLimits(key: string): { cities: number | null; services: number | null } {
  if (key === "business") return { cities: null, services: null };
  if (key === "professional" || key === "founding") return { cities: 5, services: 3 };
  return { cities: 1, services: 2 };
}

/**
 * What to tell a pro whose picks do not fit the plan, or null when they fit.
 * "Starter covers 1 city and 2 services. You picked 3 cities. …"
 */
export function planFitProblem(key: string, cityCount: number, serviceCount: number): string | null {
  const limits = planLimits(key);
  const overCities = limits.cities !== null && cityCount > limits.cities;
  const overServices = limits.services !== null && serviceCount > limits.services;
  if (!overCities && !overServices) return null;
  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const picked = [
    overCities ? count(cityCount, "city", "cities") : null,
    overServices ? count(serviceCount, "service", "services") : null,
  ].filter(Boolean).join(" and ");
  return `${PLAN_LABELS[key] ?? "This plan"} covers ${count(limits.cities ?? 0, "city", "cities")} and ${count(limits.services ?? 0, "service", "services")}. You picked ${picked}. Go back and remove some, or choose a bigger plan.`;
}

export function planByKey(key: string): Plan | undefined {
  return PLANS.find((plan) => plan.key === key);
}
