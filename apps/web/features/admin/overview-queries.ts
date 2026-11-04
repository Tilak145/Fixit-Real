/**
 * The numbers behind the owner's overview, in one place.
 *
 * Each figure answers a question someone actually asks on opening the
 * dashboard: is a customer waiting, is money owed, is the marketplace growing.
 * Nothing here is estimated — a figure that cannot be read says so rather than
 * showing a made-up number.
 */

import { requireSupabase } from "@/lib/supabase";

export interface OverviewWeek {
  /** Requests posted in the last 7 days. */
  requests: number;
  /** Requests posted in the 7 days before that. */
  previousRequests: number;
  /** Jobs a pro won in the last 7 days (a request moved off "new"). */
  won: number;
  /** Quotes sent in the last 7 days. */
  quotes: number;
  /** Customers whose first request ever was in the last 7 days. */
  newCustomers: number;
}

export interface OverviewProblems {
  emergencies: number;
  /** Emergency requests older than two hours that no crew has taken. */
  stalledEmergencies: number;
  oldUnclaimed: number;
  pendingPros: number;
  openDisputes: number;
  flaggedLeads: number;
  unverifiedJobs: number;
  trialEnding: number;
}

export interface OverviewMoney {
  commissionCents: number;
  pendingJobs: number;
  subscriptions: number;
  trialEnding: number;
}

// deno-lint-ignore no-explicit-any
type AnyQuery = any;

async function headCount(table: string, filter: (query: AnyQuery) => AnyQuery): Promise<number> {
  const { count, error } = await filter(requireSupabase().from(table).select("id", { count: "exact", head: true }));
  if (error) throw new Error(error.message);
  return count ?? 0;
}

const DAY = 86_400_000;
const iso = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();

export async function loadWeek(): Promise<OverviewWeek> {
  const supabase = requireSupabase();
  const since = iso(7 * DAY);
  const before = iso(14 * DAY);
  const [recent, earlier, won, quotes, firstRequests] = await Promise.all([
    supabase.from("quote_requests").select("id").gte("created_at", since),
    supabase.from("quote_requests").select("id").gte("created_at", before).lt("created_at", since),
    supabase.from("quote_requests").select("id").gte("created_at", since).neq("status", "new"),
    supabase.from("quotes").select("id").gte("created_at", since),
    supabase.from("quote_requests").select("customer_user_id,created_at").not("customer_user_id", "is", null),
  ]);
  for (const result of [recent, earlier, won, quotes, firstRequests]) {
    if (result.error) throw new Error(result.error.message);
  }
  // A customer is new when this week holds their earliest request.
  const earliest = new Map<string, string>();
  for (const row of (firstRequests.data ?? []) as Array<{ customer_user_id: string; created_at: string }>) {
    const now = earliest.get(row.customer_user_id);
    if (!now || row.created_at < now) earliest.set(row.customer_user_id, row.created_at);
  }
  const newCustomers = Array.from(earliest.values()).filter((created) => created >= since).length;
  return {
    requests: recent.data?.length ?? 0,
    previousRequests: earlier.data?.length ?? 0,
    won: won.data?.length ?? 0,
    quotes: quotes.data?.length ?? 0,
    newCustomers,
  };
}

export async function loadProblems(): Promise<OverviewProblems> {
  const [emergencies, stalled, oldUnclaimed, pendingPros, openDisputes, flaggedLeads, unverifiedJobs, trialEnding] =
    await Promise.all([
      headCount("quote_requests", (b) => b.eq("is_emergency", true).neq("status", "completed")),
      headCount("quote_requests", (b) => b.eq("is_emergency", true).is("claimed_by", null).lt("created_at", iso(2 * 60 * 60 * 1000))),
      headCount("quote_requests", (b) => b.eq("status", "new").lt("created_at", iso(24 * 60 * 60 * 1000))),
      headCount("providers", (b) => b.eq("status", "pending")),
      headCount("lead_disputes", (b) => b.eq("status", "open")),
      headCount("lead_flags", (b) => b.eq("status", "suspicious")),
      headCount("job_reports", (b) => b.eq("verification_status", "pending")),
      headCount("providers", (b) =>
        b.eq("plan", "founding").not("trial_ends_at", "is", null).lte("trial_ends_at", new Date(Date.now() + 14 * DAY).toISOString()),
      ),
    ]);
  return { emergencies, stalledEmergencies: stalled, oldUnclaimed, pendingPros, openDisputes, flaggedLeads, unverifiedJobs, trialEnding };
}

export interface OverviewEntry {
  id: number;
  table_name: string;
  action: "insert" | "update" | "delete";
  actor_email: string | null;
  detail: Record<string, unknown>;
  created_at: string;
}

export async function loadActivity(): Promise<OverviewEntry[]> {
  const { data, error } = await requireSupabase()
    .from("activity_log")
    .select("id,table_name,action,actor_email,detail,created_at")
    .order("created_at", { ascending: false })
    .limit(12);
  if (error) throw new Error(error.message);
  return (data ?? []) as OverviewEntry[];
}

export interface OverviewCategories {
  counts: Record<string, number>;
  idle: string[];
}

/** How many approved pros each trade has, and which trades have none. */
export async function loadCategories(core: { slug: string; name: string }[]): Promise<OverviewCategories> {
  const supabase = requireSupabase();
  const [pros, services] = await Promise.all([
    supabase.from("providers").select("id").eq("status", "approved"),
    supabase.from("provider_services").select("provider_id,category_slug"),
  ]);
  if (pros.error) throw new Error(pros.error.message);
  if (services.error) throw new Error(services.error.message);
  const approved = new Set(((pros.data ?? []) as Array<{ id: string }>).map((row) => row.id));
  const counts: Record<string, number> = Object.fromEntries(core.map((cat) => [cat.slug, 0]));
  for (const row of (services.data ?? []) as Array<{ provider_id: string; category_slug: string }>) {
    if (!approved.has(row.provider_id)) continue;
    if (row.category_slug in counts) counts[row.category_slug] += 1;
  }
  return { counts, idle: core.filter((cat) => (counts[cat.slug] ?? 0) === 0).map((cat) => cat.name) };
}
