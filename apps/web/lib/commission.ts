import { getSupabase } from "@/lib/supabase";

export * from "@/lib/commission-math";

/**
 * Management-side reads and writes that remain after the move to
 * subscription-only billing: job-report verification, fraud review and the
 * subscription overview.
 */

export type JobOutcome = "completed" | "not_completed" | "cancelled";
export type VerificationStatus = "pending" | "verified" | "disputed" | "rejected";

export interface AdminJobReport {
  id: string;
  provider_id: string;
  outcome: JobOutcome;
  job_subtotal_cents: number;
  sales_tax_cents: number;
  refunded_cents: number;
  completed_on: string | null;
  verification_status: VerificationStatus;
  verification_note: string | null;
  reported_at: string;
  business_name: string | null;
}

/** Every job report, for the verification queue. */
export async function listJobReportsForReview(): Promise<AdminJobReport[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("job_reports")
    .select(
      "id,provider_id,outcome,job_subtotal_cents,sales_tax_cents,refunded_cents,completed_on,verification_status,verification_note,reported_at",
    )
    .order("reported_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<Omit<AdminJobReport, "business_name">>;
  if (rows.length === 0) return [];
  const providerIds = [...new Set(rows.map((r) => r.provider_id))];
  const { data: providers } = await supabase.from("providers").select("id,business_name").in("id", providerIds);
  const nameById = new Map((providers ?? []).map((p) => [p.id as string, p.business_name as string]));
  return rows.map((row) => ({ ...row, business_name: nameById.get(row.provider_id) ?? null }));
}
/** Management's decision on a reported job value. */
export async function verifyJobReport(input: {
  reportId: string;
  status: "verified" | "disputed" | "rejected";
  note?: string;
}): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Data services are not connected yet.");
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("job_reports")
    .update({
      verification_status: input.status,
      verification_note: input.note ?? null,
      verified_at: new Date().toISOString(),
      verified_by: auth.user?.id ?? null,
    })
    .eq("id", input.reportId);
  if (error) throw new Error(error.message);
}


/**
 * Flag something for fraud review, or clear it. The subject is whatever is
 * suspicious: a provider, one job report, or one job report.
 */
export async function upsertFraudReview(input: {
  subjectType: "provider" | "job_report";
  subjectId: string;
  reason: string;
  status: "open" | "cleared" | "confirmed";
  note?: string;
}): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Data services are not connected yet.");
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from("fraud_reviews").upsert(
    {
      subject_type: input.subjectType,
      subject_id: input.subjectId,
      reason: input.reason,
      status: input.status,
      note: input.note ?? null,
      reviewed_at: input.status === "open" ? null : new Date().toISOString(),
      reviewed_by: input.status === "open" ? null : auth.user?.id ?? null,
    },
    { onConflict: "subject_type,subject_id" },
  );
  if (error) throw new Error(error.message);
}

export interface FraudReviewRow {
  id: string;
  subject_type: string;
  subject_id: string;
  reason: string;
  status: string;
  note: string | null;
  created_at: string;
}

export async function listFraudReviews(): Promise<FraudReviewRow[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("fraud_reviews")
    .select("id,subject_type,subject_id,reason,status,note,created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []) as FraudReviewRow[];
}

export interface SubscriptionRow {
  id: string;
  user_id: string;
  status: string;
  cancel_at_period_end: boolean;
  current_period_end: string | null;
  stripe_subscription_id: string | null;
  email: string | null;
  plan_key: string | null;
}

/**
 * Subscriptions as the billing function recorded them from Stripe. This is
 * read-only: cancelling or changing a plan happens in Stripe through the
 * customer portal, and the change lands here when Stripe's webhook arrives.
 * Only the owner can read every row; anyone else sees just their own.
 */
export async function listSubscriptionOverview(): Promise<SubscriptionRow[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("payment_subscriptions")
    .select("id,user_id,status,cancel_at_period_end,current_period_end,stripe_subscription_id")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<Omit<SubscriptionRow, "email" | "plan_key">>;
  if (rows.length === 0) return [];
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const { data: providers } = await supabase
    .from("providers")
    .select("auth_user_id,plan,email")
    .in("auth_user_id", userIds);
  const byUser = new Map(
    (providers ?? []).map((p) => [p.auth_user_id as string, { plan: p.plan as string, email: p.email as string | null }]),
  );
  return rows.map((row) => ({
    ...row,
    plan_key: byUser.get(row.user_id)?.plan ?? null,
    email: byUser.get(row.user_id)?.email ?? null,
  }));
}

