// FixIt marketplace data, read from the same project backend the website uses.
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';
import type { TrustEvidence } from '@/lib/trust-score';
import type { AvailabilityWindow } from './fixit-availability.ts';
import {
  matchesAvailabilityFilter,
  type AvailabilityFacts,
  type AvailabilityFilter,
} from './fixit-live-availability.ts';
import { PAGE_SIZE, countByFilter, placementForPlan, rankPros, takePages } from './pro-ranking.ts';
import { countProsByCategory, type CategoryProCount } from './category-counts.ts';

export interface ServiceCategory {
  slug: string;
  name: string;
  icon: string;
}

/**
 * A city FixIt serves, kept by the owner in the dashboard and read here. The
 * list is shared with the website, so the city a customer chooses is exactly
 * the string a professional's service area carries and matching holds.
 */
export interface ServiceCity {
  label: string;
  state: string;
  sort_order: number;
  is_active: boolean;
}

/** The owner's city list, in their chosen order. */
export async function listCities(): Promise<ServiceCity[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('service_cities')
    .select('label,state,sort_order,is_active')
    .order('sort_order');
  if (error) throw new Error(error.message);
  return (data ?? []) as ServiceCity[];
}

export interface ProSummary {
  id: string;
  business_name: string;
  description: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  city: string;
  areas: string[];
  rating: number;
  review_count: number;
  logo_url: string | null;
  years_in_business: string | null;
  employees: string | null;
  /** The plan the pro pays for (starter, professional, business, founding). */
  plan?: string | null;
  /** The pro's published working hours, when they have set any. */
  hours?: AvailabilityWindow[];
  /** Whether the pro is taking new work at all right now. */
  acceptingWork?: boolean;
  /** Whether the pro takes emergency and after-hours calls. */
  acceptsEmergency?: boolean;
  /** Search placement bought with the plan; lower comes first among equals. */
  placement?: number;
  /** FixIt staff checked both the licence and the insurance. */
  verified?: boolean;
}

export interface Review {
  id: string;
  author_name: string;
  rating: number;
  comment: string;
  created_at: string;
}

export type QuoteStatus = 'sent' | 'accepted' | 'declined' | 'withdrawn';

/**
 * The price a professional offered on one request. Contact details are released
 * to a professional only once the customer accepts one of these, so the quote is
 * the step that actually agrees the work.
 */
export interface JobQuote {
  id: string;
  quote_request_id: string;
  provider_id: string;
  amount_cents: number;
  /** The parts of the price. They always sum to amount_cents. */
  labour_cents: number;
  materials_cents: number;
  service_call_cents: number;
  emergency_fee_cents: number;
  other_cents: number;
  other_label: string | null;
  earliest_start: string | null;
  completion_note: string | null;
  warranty: string | null;
  payment_terms: string | null;
  valid_until: string | null;
  note: string | null;
  status: QuoteStatus;
  created_at: string;
  responded_at: string | null;
  /** Why the customer declined, written by them and shown to the professional. */
  decline_reason?: string | null;
  provider_name?: string | null;
}

/** Every column a quote read needs, shared by this app's quote reads. */
export const QUOTE_FIELDS =
  'id,quote_request_id,provider_id,amount_cents,labour_cents,materials_cents,service_call_cents,emergency_fee_cents,other_cents,other_label,earliest_start,completion_note,warranty,payment_terms,valid_until,note,status,created_at,responded_at,decline_reason';

export interface MyRequest {
  id: string;
  category_slug: string;
  description: string;
  customer_name: string;
  city: string;
  status: 'new' | 'claimed' | 'completed';
  claimed_by: string | null;
  created_at: string;
  provider_name?: string | null;
  /** The prices professionals have sent on this request, newest first. */
  quotes?: JobQuote[];
  /** Photos and a video the customer sent, each with a private link. */
  media?: Array<RequestMedia & { url: string | null }>;
}

export interface Appointment {
  id: string;
  quote_request_id: string | null;
  title: string;
  customer_name: string;
  city: string;
  scheduled_for: string;
  status: string;
  notes: string | null;
}

export interface Message {
  id: string;
  quote_request_id: string;
  sender_role: 'customer' | 'provider';
  body: string;
  created_at: string;
}

export function isBackendConfigured(): boolean {
  return getSupabase() !== null;
}

/** The ten launch categories, in the design's order. */
export const CORE_CATEGORIES: ServiceCategory[] = [
  { slug: 'plumbing', name: 'Plumbing', icon: 'plumbing' },
  { slug: 'electrical', name: 'Electrical', icon: 'electrical' },
  { slug: 'hvac', name: 'HVAC', icon: 'hvac' },
  { slug: 'garage-doors', name: 'Garage Doors', icon: 'garage-doors' },
  { slug: 'roofing', name: 'Roofing', icon: 'roofing' },
  { slug: 'appliance-repair', name: 'Appliance Repair', icon: 'appliance-repair' },
  { slug: 'handyman', name: 'Handyman', icon: 'handyman' },
  { slug: 'cleaning', name: 'Cleaning', icon: 'cleaning' },
  { slug: 'pest-control', name: 'Pest Control', icon: 'pest-control' },
  { slug: 'landscaping', name: 'Landscaping', icon: 'landscaping' },
];

export function categoryName(slug: string): string {
  return CORE_CATEGORIES.find(category => category.slug === slug)?.name ?? 'Home service';
}

export async function listCategories(): Promise<ServiceCategory[]> {
  const supabase = getSupabase();
  if (!supabase) return CORE_CATEGORIES;
  const { data, error } = await supabase
    .from('service_categories')
    .select('slug,name,icon')
    .order('sort_order');
  if (error) throw new Error(error.message);
  // Always keep the ten launch categories, in the design's order.
  return CORE_CATEGORIES.map(category => data?.find(row => row.slug === category.slug) ?? category);
}

/** The most professionals one list reads; the database also stops at its own row cap. */
const MATCH_LIMIT = 1000;

/**
 * How many professionals stand behind each service in a city: everyone listed
 * (`total`), and the ones who can be reached this minute (`availableNow`). One
 * query with the city matched inside it, so no list of ids is sent however many
 * professionals there are.
 */
export async function listCategoryProCounts(city?: string | null): Promise<Record<string, CategoryProCount>> {
  const supabase = getSupabase();
  if (!supabase) return {};
  const select = [
    'id,accepting_work,accepts_emergency',
    'provider_services(category_slug)',
    'provider_availability(weekday,start_minute,end_minute)',
  ];
  if (city) select.push('provider_service_areas!inner(city)');
  let query = supabase.from('providers').select(select.join(',')).eq('status', 'approved').limit(MATCH_LIMIT);
  if (city) query = query.eq('provider_service_areas.city', city);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const factsByProvider = new Map<string, AvailabilityFacts>();
  const services: { provider_id: string; category_slug: string }[] = [];
  for (const row of (data ?? []) as unknown as Array<Record<string, unknown>>) {
    const id = row.id as string;
    factsByProvider.set(id, {
      acceptingWork: row.accepting_work !== false,
      acceptsEmergency: Boolean(row.accepts_emergency),
      windows: ((row.provider_availability ?? []) as Array<Record<string, number>>).map(hour => ({
        weekday: hour.weekday,
        startMinute: hour.start_minute,
        endMinute: hour.end_minute,
      })),
    });
    for (const service of (row.provider_services ?? []) as Array<{ category_slug: string }>) {
      services.push({ provider_id: id, category_slug: service.category_slug });
    }
  }
  return countProsByCategory(services, factsByProvider, new Date());
}

type ProRow = {
  id: string;
  business_name: string;
  description: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  rating: number;
  review_count: number;
  logo_url: string | null;
  years_in_business: string | null;
  employees: string | null;
  plan?: string | null;
  accepting_work?: boolean | null;
  accepts_emergency?: boolean | null;
};

const PRO_FIELDS =
  'id,business_name,description,email,phone,website,address,rating,review_count,logo_url,years_in_business,employees,plan,accepting_work,accepts_emergency';

async function withAreas(pros: ProRow[]): Promise<ProSummary[]> {
  const fallback = 'Akron, OH';
  if (pros.length === 0) return [];
  const supabase = getSupabase();
  if (!supabase) return pros.map(pro => ({ ...pro, city: fallback, areas: [] }));
  const { data } = await supabase
    .from('provider_service_areas')
    .select('provider_id,city')
    .in('provider_id', pros.map(pro => pro.id));
  return pros.map(pro => {
    const areas = (data ?? []).filter(area => area.provider_id === pro.id).map(area => area.city as string);
    return { ...pro, city: areas[0] ?? fallback, areas };
  });
}

export interface ProFilter {
  categorySlug?: string;
  /** The exact city label, as the owner's city list spells it ("Akron, OH"). */
  city?: string;
  /** Only professionals on one of these plans. */
  plans?: string[];
  /** Only professionals with a live paid subscription. */
  paidOnly?: boolean;
  /** How many to return from the ranked list; 24 when not given. */
  limit?: number;
}

type Match = Omit<ProSummary, 'city' | 'areas'> & { facts: AvailabilityFacts; placement: number; rating: number };

/**
 * Every approved professional who fits the filter, with the little needed to
 * rank them. The city and trade are matched inside the query (an inner join), so
 * no long list of ids is sent however many professionals there are.
 */
async function loadMatches(supabase: SupabaseClient, filter: ProFilter): Promise<Match[]> {
  const select = [PRO_FIELDS, 'provider_availability(weekday,start_minute,end_minute)'];
  if (filter.city) select.push('provider_service_areas!inner(city)');
  if (filter.categorySlug) select.push('provider_services!inner(category_slug)');
  let query = supabase.from('providers').select(select.join(',')).eq('status', 'approved').limit(MATCH_LIMIT);
  if (filter.city) query = query.eq('provider_service_areas.city', filter.city);
  if (filter.categorySlug) query = query.eq('provider_services.category_slug', filter.categorySlug);
  if (filter.plans?.length) query = query.in('plan', filter.plans);
  // A plan is only chosen at sign-up; a paid one is proved by a live subscription.
  let payingIds: Set<string> | null = null;
  if (filter.paidOnly) {
    const { data: paying, error: payingError } = await supabase.rpc('paying_provider_ids');
    if (payingError) throw new Error(payingError.message);
    payingIds = new Set((paying ?? []) as string[]);
    if (payingIds.size === 0) return [];
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = ((data ?? []) as unknown as Array<Record<string, unknown>>).filter(
    row => !payingIds || payingIds.has(row.id as string),
  );
  return rows.map(row => {
    const { provider_availability: hourRows, provider_service_areas: _areas, provider_services: _services, ...rest } = row;
    void _areas;
    void _services;
    const hours: AvailabilityWindow[] = ((hourRows ?? []) as Array<Record<string, number>>).map(hour => ({
      weekday: hour.weekday,
      startMinute: hour.start_minute,
      endMinute: hour.end_minute,
    }));
    const pro = rest as unknown as ProRow;
    // A missing switch means "not loaded": it must not hide a working pro.
    const facts: AvailabilityFacts = {
      acceptingWork: pro.accepting_work === null || pro.accepting_work === undefined ? true : Boolean(pro.accepting_work),
      acceptsEmergency: Boolean(pro.accepts_emergency),
      windows: hours,
    };
    return {
      ...pro,
      hours,
      acceptingWork: facts.acceptingWork,
      acceptsEmergency: facts.acceptsEmergency,
      facts,
      placement: placementForPlan(pro.plan),
      rating: Number(pro.rating ?? 0),
    };
  });
}

/** The professionals a page will show, with the extras a card needs (city, check mark). */
async function finishPros(supabase: SupabaseClient, matches: Match[], city: string | undefined): Promise<ProSummary[]> {
  if (matches.length === 0) return [];
  const ids = matches.map(match => match.id);
  const [areas, verified] = await Promise.all([
    city
      ? Promise.resolve({ data: [] as Array<{ provider_id: string; city: string }> })
      : supabase.from('provider_service_areas').select('provider_id,city').in('provider_id', ids),
    // The check mark: set only when staff confirmed both licence and insurance.
    supabase.from('provider_trust_evidence').select('provider_id,license_checked,insurance_checked').in('provider_id', ids),
  ]);
  const areaRows = (areas.data ?? []) as Array<{ provider_id: string; city: string }>;
  const verifiedIds = new Set(
    (verified.data ?? [])
      .filter(row => row.license_checked && row.insurance_checked)
      .map(row => row.provider_id as string),
  );
  return matches.map(({ facts, ...match }) => {
    void facts;
    const own = areaRows.filter(area => area.provider_id === match.id).map(area => area.city);
    return {
      ...match,
      verified: verifiedIds.has(match.id),
      // Everyone in a city's list serves that city, so the card names it.
      city: city ?? own[0] ?? 'Akron, OH',
      areas: city ? [city] : own,
    };
  });
}

export interface ProPage {
  pros: ProSummary[];
  /** Everyone who serves the city and trade, before any availability filter. */
  matched: number;
  /** How many fit the chosen availability filter, over the whole list. */
  total: number;
  /** How many fit each availability filter, over the whole list. */
  counts: Record<AvailabilityFilter, number>;
  hasMore: boolean;
}

/**
 * A page of professionals for a city and trade. Every match is ranked first (who
 * can help soonest, then paid placement, then rating) and the page is taken from
 * that ranked list, so a paying professional with no reviews is never dropped
 * just because better-rated ones exist. `page` 2 means the first two pages, so
 * "Show more" adds to what is already on screen.
 */
export async function searchPros(
  filter: ProFilter = {},
  options: { page?: number; pageSize?: number; when?: AvailabilityFilter | 'all' } = {},
): Promise<ProPage> {
  const empty: ProPage = { pros: [], matched: 0, total: 0, counts: { any: 0, today: 0, tomorrow: 0, emergency: 0 }, hasMore: false };
  const supabase = getSupabase();
  if (!supabase) return empty;
  const now = new Date();
  const all = await loadMatches(supabase, filter);
  if (all.length === 0) return empty;
  const when = options.when ?? 'all';
  const fitting = when === 'all' ? all : all.filter(match => matchesAvailabilityFilter(match.facts, when, now));
  const { items, hasMore } = takePages(rankPros(fitting, now), options.page ?? 1, options.pageSize ?? PAGE_SIZE);
  return {
    pros: await finishPros(supabase, items, filter.city),
    matched: all.length,
    total: fitting.length,
    counts: countByFilter(all, now),
    hasMore,
  };
}

export async function listPros(filter: ProFilter = {}): Promise<ProSummary[]> {
  return (await searchPros(filter, { page: 1, pageSize: filter.limit ?? 24, when: 'all' })).pros;
}

export async function getPro(id: string): Promise<ProSummary | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('providers')
    .select(PRO_FIELDS)
    .eq('id', id)
    .eq('status', 'approved')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const [pro] = await withAreas([data as ProRow]);
  return pro ?? null;
}

/**
 * The evidence behind a professional's trust score, counted by the database.
 * Returns null when it is unavailable, which means no claim either way rather
 * than a score of zero.
 */
export async function getProTrustEvidence(id: string): Promise<TrustEvidence | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('provider_trust_evidence')
    .select('*')
    .eq('provider_id', id)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as Record<string, unknown>;
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
    lastReviewAt: (row.last_review_at as string | null) ?? null,
    disputesRaised: Number(row.disputes_raised ?? 0),
    upheldComplaints: Number(row.upheld_complaints ?? 0),
    joinedAt: (row.joined_at as string | null) ?? null,
  };
}

export async function listProReviews(proId: string): Promise<Review[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('reviews')
    .select('id,author_name,rating,comment,created_at')
    .eq('provider_id', proId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return (data ?? []) as Review[];
}

export async function listProServices(proId: string): Promise<string[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data } = await supabase.from('provider_services').select('category_slug').eq('provider_id', proId);
  return (data ?? []).map(row => categoryName(row.category_slug as string));
}

export interface QuoteRequestInput {
  categorySlug: string;
  description: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  city: string;
  /** Where the work is, so the pro who accepts the job can find the door. */
  customerAddress?: string | null;
  userId?: string | null;
  /** The customer said the job cannot wait. */
  isEmergency?: boolean;
  /** What the customer expects to spend, if they said. Cents. */
  budgetMinCents?: number | null;
  budgetMaxCents?: number | null;
}

/** Creates the request and returns its id, which its photos are stored under. */
export async function submitQuoteRequest(input: QuoteRequestInput): Promise<string> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error('Data services are not connected yet, so your request cannot be saved. Please try again later.');
  }
  const { data, error } = await supabase
    .from('quote_requests')
    .insert({
      category_slug: input.categorySlug,
      description: input.description,
      customer_name: input.customerName,
      customer_email: input.customerEmail,
      customer_phone: input.customerPhone || null,
      city: input.city,
      customer_address: input.customerAddress?.trim() || null,
      customer_user_id: input.userId ?? null,
      is_emergency: input.isEmergency ?? false,
      budget_min_cents: input.budgetMinCents ?? null,
      budget_max_cents: input.budgetMaxCents ?? null,
      budget_set_at:
        input.budgetMinCents == null && input.budgetMaxCents == null ? null : new Date().toISOString(),
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(error ? error.message : 'Your request could not be saved.');
  return data.id as string;
}

/** One photo or video a customer sent with a job. */
export interface RequestMedia {
  id: string;
  quote_request_id: string;
  kind: 'photo' | 'video';
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
}

/** What a customer may attach: a still, or one short clip. */
export const MEDIA_ACCEPT = ['image/*', 'video/*'];

const MAX_MEDIA_BYTES = 25 * 1024 * 1024;

/**
 * Upload one photo or video for a job. The file is stored under the request's
 * own id, which is what the storage rules check, so a customer can only add
 * media to their own request and nobody can open a job photo they are not
 * entitled to.
 *
 * The bytes are read from the local file and sent as a blob, so a phone photo
 * goes straight to storage without being held in memory as a data URL.
 */
export async function uploadRequestMedia(input: {
  requestId: string;
  uri: string;
  fileName: string;
  mimeType: string | null;
  size: number | null;
}): Promise<RequestMedia> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Data services are not connected yet, so the file cannot be saved.');
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Please sign in first so your photos are kept with your request.');
  if ((input.size ?? 0) > MAX_MEDIA_BYTES) {
    throw new Error('That file is larger than 25 MB. Please choose a smaller file or a shorter clip.');
  }

  const kind: 'photo' | 'video' = (input.mimeType ?? '').startsWith('video/') ? 'video' : 'photo';
  const safeName = input.fileName.replace(/[^A-Za-z0-9._-]/g, '_').slice(-80) || kind;
  const path = input.requestId + '/' + Date.now() + '-' + safeName;

  // React Native has no File, so the bytes are read with fetch and uploaded as
  // an ArrayBuffer, which the storage client accepts directly.
  const response = await fetch(input.uri);
  const bytes = await response.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from('request-media')
    .upload(path, bytes, { contentType: input.mimeType ?? undefined });
  if (uploadError) throw new Error(uploadError.message);

  const { data, error } = await supabase
    .from('quote_request_media')
    .insert({
      quote_request_id: input.requestId,
      uploaded_by: auth.user.id,
      kind,
      storage_path: path,
      file_name: input.fileName,
      mime_type: input.mimeType,
      size_bytes: input.size,
    })
    .select('id,quote_request_id,kind,storage_path,file_name,mime_type,size_bytes,created_at')
    .single();
  if (error) throw new Error(error.message);
  return data as RequestMedia;
}

/** The media on a set of requests, each with a short-lived private link. */
export async function getRequestMedia(
  requestIds: string[],
): Promise<Record<string, Array<RequestMedia & { url: string | null }>>> {
  const supabase = getSupabase();
  const result: Record<string, Array<RequestMedia & { url: string | null }>> = {};
  if (!supabase || requestIds.length === 0) return result;
  const { data, error } = await supabase
    .from('quote_request_media')
    .select('id,quote_request_id,kind,storage_path,file_name,mime_type,size_bytes,created_at')
    .in('quote_request_id', requestIds)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as RequestMedia[];
  const signed = new Map<string, string>();
  if (rows.length > 0) {
    const { data: links } = await supabase.storage
      .from('request-media')
      .createSignedUrls(rows.map(row => row.storage_path), 60 * 60);
    for (const link of links ?? []) {
      if (link.path && link.signedUrl) signed.set(link.path, link.signedUrl);
    }
  }
  for (const row of rows) {
    const list = result[row.quote_request_id] ?? [];
    list.push({ ...row, url: signed.get(row.storage_path) ?? null });
    result[row.quote_request_id] = list;
  }
  return result;
}

/**
 * The signed-in customer's own quote requests, newest first, with the name of
 * the professional who accepted it, if any.
 */
export async function listMyRequests(userId: string): Promise<MyRequest[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('quote_requests')
    .select('id,category_slug,description,customer_name,city,status,claimed_by,created_at')
    .eq('customer_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(40);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as MyRequest[];
  if (rows.length === 0) return rows;

  // The professionals who quoted are not necessarily the one who claimed the
  // job — with comparison, several quote and the customer chooses one — so the
  // names come from the quotes themselves, not only from claimed_by.
  const nameById = new Map<string, string>();
  const loadNames = async (ids: string[]) => {
    const unique = Array.from(new Set(ids.filter(Boolean)));
    if (unique.length === 0) return;
    const { data: providers } = await supabase.from('providers').select('id,business_name').in('id', unique);
    for (const row of providers ?? []) nameById.set(row.id as string, row.business_name as string);
  };
  await loadNames(rows.map(row => row.claimed_by).filter((value): value is string => Boolean(value)));

  const withNames = rows.map(row => ({
    ...row,
    provider_name: row.claimed_by ? nameById.get(row.claimed_by) ?? null : null,
  }));

  // The quotes on these requests, in one read for the whole list. Row Level
  // Security returns the customer's own, so no extra filter is needed.
  if (withNames.length === 0) return withNames;
  const { data: quotes } = await supabase
    .from('quotes')
    .select(QUOTE_FIELDS)
    .in('quote_request_id', withNames.map(row => row.id))
    .order('created_at', { ascending: false });
  await loadNames(((quotes ?? []) as JobQuote[]).map(row => row.provider_id));

  // The customer's own photos, with private links, so their request shows what
  // they sent. Only the files on their own requests come back.
  const mediaByRequest = await getRequestMedia(withNames.map(row => row.id));
  const quotesByRequest = new Map<string, JobQuote[]>();
  for (const row of (quotes ?? []) as JobQuote[]) {
    const list = quotesByRequest.get(row.quote_request_id) ?? [];
    list.push({ ...row, provider_name: nameById.get(row.provider_id) ?? null });
    quotesByRequest.set(row.quote_request_id, list);
  }
  return withNames.map(row => ({
    ...row,
    quotes: quotesByRequest.get(row.id) ?? [],
    media: mediaByRequest[row.id] ?? [],
  }));
}

/** A decline must say why; the database refuses one that does not. */
export const DECLINE_REASON_MIN = 3;
export const DECLINE_REASON_MAX = 500;

/** Common reasons, offered as a start so declining stays one tap and a word. */
export const DECLINE_REASONS = [
  'The price is too high',
  'I need it done sooner',
  'I chose another professional',
  'I no longer need the work',
];

/**
 * The customer accepts or declines the price a professional sent. A decline
 * carries the reason the customer gives, which the professional reads beside
 * their quote.
 */
export async function respondToQuote(input: {
  quoteId: string;
  response: 'accepted' | 'declined';
  reason?: string;
}): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Quoting is not connected yet.');
  const reason = input.reason?.trim() ?? '';
  if (input.response === 'declined' && reason.length < DECLINE_REASON_MIN) {
    throw new Error('Please say why you are declining, so the professional knows.');
  }
  const { error } = await supabase
    .from('quotes')
    .update(
      input.response === 'declined'
        ? { status: 'declined', decline_reason: reason.slice(0, DECLINE_REASON_MAX) }
        : { status: 'accepted' },
    )
    .eq('id', input.quoteId)
    .eq('status', 'sent');
  if (error) throw new Error(error.message);
}

/** Formats a quote amount for display, in whole cents. */
export function formatCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const value = Math.abs(Math.round(cents));
  return sign + '$' + Math.floor(value / 100).toLocaleString() + '.' + String(value % 100).padStart(2, '0');
}

/** Visits a professional scheduled for this customer, soonest first. */
export async function listMyAppointments(): Promise<Appointment[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('appointments')
    .select('id,quote_request_id,title,customer_name,city,scheduled_for,status,notes')
    .order('scheduled_for', { ascending: true })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as Appointment[];
}

/** The message thread for one quote request, oldest first. */
export async function listMessages(requestId: string): Promise<Message[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('messages')
    .select('id,quote_request_id,sender_role,body,created_at')
    .eq('quote_request_id', requestId)
    .order('created_at', { ascending: true })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []) as Message[];
}

/**
 * Post to a thread as the customer. The database refuses a message written for
 * the other side, so the role says who is typing, not what is allowed.
 */
export async function sendMessage(input: { requestId: string; body: string }): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Messaging is not connected yet.');
  const { data } = await supabase.auth.getUser();
  const { error } = await supabase.from('messages').insert({
    quote_request_id: input.requestId,
    sender_role: 'customer',
    sender_user_id: data.user?.id ?? null,
    body: input.body.trim(),
  });
  if (error) throw new Error(error.message);
}

/** The signed-in customer's existing review of one professional, if any. */
export async function getMyReview(
  providerId: string,
  userId: string,
): Promise<{ id: string; rating: number; comment: string } | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('reviews')
    .select('id,rating,comment')
    .eq('provider_id', providerId)
    .eq('author_user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as { id: string; rating: number; comment: string } | null) ?? null;
}

/** Post or update the customer's review. One review per customer per pro. */
export async function submitReview(input: {
  providerId: string;
  rating: number;
  comment: string;
}): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Reviews are not connected yet.');
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) throw new Error('Sign in to leave a review.');
  const name = (user.user_metadata?.full_name as string | undefined) ?? user.email ?? 'A FixIt customer';
  const existing = await getMyReview(input.providerId, user.id);
  const fields = { rating: input.rating, comment: input.comment.trim(), author_name: name };
  if (existing) {
    const { error } = await supabase.from('reviews').update(fields).eq('id', existing.id);
    if (error) throw new Error(error.message);
    return;
  }
  const { error } = await supabase.from('reviews').insert({
    provider_id: input.providerId,
    author_user_id: user.id,
    ...fields,
  });
  if (error) throw new Error(error.message);
}
