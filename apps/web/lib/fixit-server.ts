import "server-only";

import { cookies } from "next/headers";
import { CITY_COOKIE, resolveCity } from "@/lib/city-choice";
import { getSupabase } from "@/lib/supabase";
import { getServerPublicSupabase } from "@/lib/supabase-public-server";
import type { ProSummary, Review, ServiceCategory, ServiceCity } from "@/lib/fixit";
import type { AvailabilityWindow } from "@/lib/fixit-availability";
import { compareByAvailability, type AvailabilityFacts } from "@/lib/fixit-live-availability";
import type { TrustEvidence } from "@/lib/trust-score";
import { countProsByCategory, type CategoryProCount } from "@/lib/category-counts";

/**
 * Public reads for Server Components. Reads use the anonymous server client
 * when the environment provides it, and fall back to the browser client only
 * when a global runtime config is present.
 */
async function publicClient() {
  return (await getServerPublicSupabase()) ?? getSupabase();
}

const CORE_CATEGORIES: ServiceCategory[] = [
  { slug: "plumbing", name: "Plumbing", icon: "plumbing" },
  { slug: "electrical", name: "Electrical", icon: "electrical" },
  { slug: "hvac", name: "HVAC", icon: "hvac" },
  { slug: "garage-doors", name: "Garage Doors", icon: "garage-doors" },
  { slug: "roofing", name: "Roofing", icon: "roofing" },
  { slug: "appliance-repair", name: "Appliance Repair", icon: "appliance-repair" },
  { slug: "handyman", name: "Handyman", icon: "handyman" },
  { slug: "cleaning", name: "Cleaning", icon: "cleaning" },
  { slug: "pest-control", name: "Pest Control", icon: "pest-control" },
  { slug: "landscaping", name: "Landscaping", icon: "landscaping" },
];

export async function isBackendConfigured(): Promise<boolean> {
  return (await publicClient()) !== null;
}

export async function listCategories(): Promise<ServiceCategory[]> {
  const supabase = await publicClient();
  if (!supabase) return CORE_CATEGORIES;
  const { data, error } = await supabase
    .from("service_categories")
    .select("slug,name,icon")
    .order("sort_order");
  if (error) throw new Error(error.message);
  return CORE_CATEGORIES.map((category) => data?.find((row) => row.slug === category.slug) ?? category);
}

/**
 * The owner's city list, read on the server for the pages that render before a
 * browser session exists. An empty list is honest: it means no city has been
 * added yet, and the forms fall back to free text rather than inventing one.
 */
export async function listCities(): Promise<ServiceCity[]> {
  const supabase = await publicClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("service_cities")
    .select("label,state,sort_order,is_active")
    .order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []) as ServiceCity[];
}

/**
 * The city this visitor is shopping in, decided on the server: the city in the
 * link, else the one they picked before (the cookie), else the first city the
 * owner offers. Every page that lists professionals uses this one answer, so a
 * visitor in Hudson is never shown another city's professionals.
 */
export async function resolveVisitorCity(
  cityParam?: string | null,
): Promise<{ cities: ServiceCity[]; chosenCity: string | null }> {
  const cities = (await listCities()).filter((city) => city.is_active);
  let remembered: string | null = null;
  try {
    const raw = (await cookies()).get(CITY_COOKIE)?.value;
    remembered = raw ? decodeURIComponent(raw) : null;
  } catch {
    remembered = null;
  }
  return { cities, chosenCity: resolveCity(cities.map((city) => city.label), cityParam, remembered) };
}

export async function getCategory(slug: string): Promise<ServiceCategory | null> {
  const categories = await listCategories();
  return categories.find((category) => category.slug === slug) ?? null;
}

export interface ProFilter {
  categorySlug?: string;
  city?: string;
}

const PRO_FIELDS =
  "id,business_name,description,rating,review_count,logo_url,years_in_business,status,accepts_emergency,accepting_work";

export async function listPros(filter: ProFilter = {}): Promise<ProSummary[]> {
  const supabase = await publicClient();
  if (!supabase) return [];
  let query = supabase
    .from("providers")
    .select(PRO_FIELDS)
    .eq("status", "approved")
    .order("rating", { ascending: false })
    .limit(24);
  // A chosen city narrows the list first, in the query itself, so a visitor
  // shopping in Kent sees only professionals who serve Kent, however many
  // businesses the other cities have.
  if (filter.city) {
    const { data: areaMatches, error: areaError } = await supabase
      .from("provider_service_areas")
      .select("provider_id")
      .eq("city", filter.city);
    if (areaError) throw new Error(areaError.message);
    const covered = (areaMatches ?? []).map((row) => row.provider_id as string);
    if (covered.length === 0) return [];
    query = query.in("id", covered);
  }
  if (filter.categorySlug) {
    const { data: ids, error: idsError } = await supabase
      .from("provider_services")
      .select("provider_id")
      .eq("category_slug", filter.categorySlug);
    if (idsError) throw new Error(idsError.message);
    const idList = (ids ?? []).map((row) => row.provider_id);
    if (idList.length === 0) return [];
    query = query.in("id", idList);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Omit<ProSummary, "city">[];
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);
  const [{ data: areaRows }, { data: hourRows }] = await Promise.all([
    supabase.from("provider_service_areas").select("provider_id,city").in("provider_id", ids),
    supabase
      .from("provider_availability")
      .select("provider_id,weekday,start_minute,end_minute")
      .in("provider_id", ids),
  ]);
  const cityByProvider = new Map((areaRows ?? []).map((area) => [area.provider_id as string, area.city as string]));
  const hoursByProvider = new Map<string, AvailabilityWindow[]>();
  for (const row of hourRows ?? []) {
    const list = hoursByProvider.get(row.provider_id as string) ?? [];
    list.push({
      weekday: row.weekday as number,
      startMinute: row.start_minute as number,
      endMinute: row.end_minute as number,
    });
    hoursByProvider.set(row.provider_id as string, list);
  }
  // Placement bought with the plan, and the service area, read from the view
  // that computes them. A missing row means no plan data, which the comparator
  // treats as neutral rather than as the lowest placement.
  const { data: placementRows } = await supabase
    .from("provider_placement")
    .select("provider_id,placement")
    .in("provider_id", ids);
  const placementByProvider = new Map(
    (placementRows ?? []).map((row) => [row.provider_id as string, row.placement as number]),
  );
  // The check mark: set only when staff confirmed both licence and insurance.
  const { data: verifiedRows } = await supabase
    .from("provider_trust_evidence")
    .select("provider_id,license_checked,insurance_checked")
    .in("provider_id", ids);
  const verifiedIds = new Set(
    (verifiedRows ?? [])
      .filter((row) => row.license_checked && row.insurance_checked)
      .map((row) => row.provider_id as string),
  );
  const withAvailability = rows.map((row) => ({
    ...row,
    verified: verifiedIds.has(row.id),
    // Everyone in a city's list serves that city, so the card names it rather
    // than whichever of the business's cities happened to be read last.
    city: filter.city ?? cityByProvider.get(row.id) ?? "Akron, OH",
    hours: hoursByProvider.get(row.id) ?? [],
    placement: placementByProvider.get(row.id),
  }));

  // A customer is asking "who can help me soon?", so available professionals
  // come first, then whoever opens soonest, and rating breaks the tie. Sorting
  // in the product rather than the query keeps the rule in one testable place.
  const now = new Date();
  return withAvailability.sort((a, b) =>
    compareByAvailability(
      { facts: factsOf(a), rating: a.rating ?? 0, placement: a.placement },
      { facts: factsOf(b), rating: b.rating ?? 0, placement: b.placement },
      now,
    ),
  );
}

/** The availability facts of a provider row, as the shared rule expects them. */
function factsOf(row: {
  accepting_work?: boolean | null;
  accepts_emergency?: boolean | null;
  hours?: AvailabilityWindow[];
}): AvailabilityFacts {
  return {
    // Absent means "not loaded"; a missing value must not hide a working pro.
    acceptingWork: row.accepting_work === null || row.accepting_work === undefined ? true : Boolean(row.accepting_work),
    acceptsEmergency: Boolean(row.accepts_emergency),
    windows: row.hours ?? [],
  };
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

export async function getPro(id: string): Promise<ProSummary | null> {
  // The database rejects a malformed id with an error, but to a visitor a
  // mistyped link simply means there is no such professional.
  if (!UUID_PATTERN.test(id)) return null;
  const supabase = await publicClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("providers")
    .select(PRO_FIELDS)
    .eq("id", id)
    .eq("status", "approved")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const [{ data: areas }, { data: hours }] = await Promise.all([
    supabase.from("provider_service_areas").select("city").eq("provider_id", id),
    // The pro's published working hours, shown to customers choosing who to hire.
    supabase
      .from("provider_availability")
      .select("weekday,start_minute,end_minute")
      .eq("provider_id", id)
      .order("weekday", { ascending: true }),
  ]);
  const cities = (areas ?? []).map((area) => area.city);
  const windows = (hours ?? []).map((row) => ({
    weekday: row.weekday as number,
    startMinute: row.start_minute as number,
    endMinute: row.end_minute as number,
  }));
  return {
    ...data,
    city: cities[0] ?? "Akron, OH",
    areas: cities,
    hours: windows,
    acceptingWork: data.accepting_work === null ? true : Boolean(data.accepting_work),
    acceptsEmergency: Boolean(data.accepts_emergency),
  } as ProSummary;
}

/** A pro's evidence row, as the database counts it. */
interface TrustEvidenceRow {
  provider_id: string;
  license_checked: boolean;
  insurance_checked: boolean;
  insurance_on_file: boolean;
  verified_jobs: number;
  unverified_jobs: number;
  median_response_hours: number | null;
  quotes_sent: number;
  visits_completed: number;
  visits_cancelled: number;
  review_count: number;
  review_average: number;
  last_review_at: string | null;
  disputes_raised: number;
  upheld_complaints: number;
  joined_at: string | null;
}

/** Turn a database evidence row into the shape the score is computed from. */
export function toTrustEvidence(row: TrustEvidenceRow): TrustEvidence {
  return {
    licenseChecked: Boolean(row.license_checked),
    insuranceChecked: Boolean(row.insurance_checked),
    insuranceOnFile: Boolean(row.insurance_on_file),
    verifiedJobs: Number(row.verified_jobs ?? 0),
    unverifiedJobs: Number(row.unverified_jobs ?? 0),
    medianResponseHours: row.median_response_hours === null ? null : Number(row.median_response_hours),
    visitsCompleted: Number(row.visits_completed ?? 0),
    visitsCancelled: Number(row.visits_cancelled ?? 0),
    quotesSent: Number(row.quotes_sent ?? 0),
    reviewCount: Number(row.review_count ?? 0),
    reviewAverage: Number(row.review_average ?? 0),
    lastReviewAt: row.last_review_at,
    disputesRaised: Number(row.disputes_raised ?? 0),
    upheldComplaints: Number(row.upheld_complaints ?? 0),
    joinedAt: row.joined_at,
  };
}

/** The trust evidence for one professional, or null when the view is unavailable. */
export async function getProTrustEvidence(providerId: string): Promise<TrustEvidence | null> {
  const supabase = await publicClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("provider_trust_evidence")
    .select("*")
    .eq("provider_id", providerId)
    .maybeSingle();
  if (error || !data) return null;
  return toTrustEvidence(data as unknown as TrustEvidenceRow);
}

export async function listProReviews(proId: string): Promise<Review[]> {
  const supabase = await publicClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("reviews")
    .select("id,author_name,rating,comment,created_at")
    .eq("provider_id", proId)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw new Error(error.message);
  return (data ?? []) as Review[];
}

/**
 * How many approved professionals offer each service, keyed by category slug.
 * The home grid uses it to keep a category with no one behind it from looking
 * bookable.
 */
export async function listCategoryProCounts(city?: string | null): Promise<Record<string, CategoryProCount>> {
  const supabase = await publicClient();
  if (!supabase) return {};
  const { data: providers, error } = await supabase
    .from("providers")
    .select("id,accepting_work,accepts_emergency")
    .eq("status", "approved");
  if (error) throw new Error(error.message);
  let ids = (providers ?? []).map((row) => row.id as string);
  if (ids.length === 0) return {};
  // With a city chosen, "3 local pros" counts only those who serve that city.
  if (city) {
    const { data: areas, error: areasError } = await supabase
      .from("provider_service_areas")
      .select("provider_id")
      .eq("city", city);
    if (areasError) throw new Error(areasError.message);
    const covered = new Set((areas ?? []).map((row) => row.provider_id as string));
    ids = ids.filter((id) => covered.has(id));
    if (ids.length === 0) return {};
  }
  const [{ data: services, error: servicesError }, { data: hourRows, error: hoursError }] = await Promise.all([
    supabase.from("provider_services").select("provider_id,category_slug").in("provider_id", ids),
    supabase
      .from("provider_availability")
      .select("provider_id,weekday,start_minute,end_minute")
      .in("provider_id", ids),
  ]);
  if (servicesError) throw new Error(servicesError.message);
  if (hoursError) throw new Error(hoursError.message);
  // The card shows who can be reached this minute, so each professional's
  // switch and published hours are read alongside the trades they offer.
  const kept = new Set(ids);
  const factsByProvider = new Map<string, AvailabilityFacts>();
  for (const row of providers ?? []) {
    if (!kept.has(row.id as string)) continue;
    factsByProvider.set(row.id as string, {
      acceptingWork: row.accepting_work !== false,
      acceptsEmergency: Boolean(row.accepts_emergency),
      windows: [],
    });
  }
  for (const row of hourRows ?? []) {
    factsByProvider.get(row.provider_id as string)?.windows.push({
      weekday: row.weekday as number,
      startMinute: row.start_minute as number,
      endMinute: row.end_minute as number,
    });
  }
  return countProsByCategory(
    (services ?? []) as { provider_id: string; category_slug: string }[],
    factsByProvider,
    new Date(),
  );
}
