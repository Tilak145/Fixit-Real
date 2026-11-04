import { getSupabase } from "@/lib/supabase";

export * from "@/lib/commission-math";

/**
 * The commission and lead-allowance rules, shared by the contractor dashboard,
 * the admin dashboard and the tests.
 *
 * The arithmetic itself is in commission-math.ts, which has no imports and is
 * tested directly: a wrong commission is a charge a contractor will dispute, so
 * the calculation is the one part that must be provably right.
 */

export interface CommissionSettings {
  plan_key: string;
  commission_rate_bps: number;
  commission_cap_cents: number | null;
  included_leads: number;
}

export type AllowanceStatus = "included" | "commissionable";
export type JobOutcome = "completed" | "not_completed" | "cancelled";
export type VerificationStatus = "pending" | "verified" | "disputed" | "rejected";
export type CommissionStatus = "pending" | "payable" | "paid" | "waived" | "void";

/* -------------------------------------------------------------------------- */
/* Reads and writes                                                            */
/* -------------------------------------------------------------------------- */

export async function getCommissionSettings(): Promise<CommissionSettings[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("commission_settings")
    .select("plan_key,commission_rate_bps,commission_cap_cents,included_leads")
    .order("plan_key");
  if (error) throw new Error(error.message);
  return (data ?? []) as CommissionSettings[];
}

export interface MyLeadUsage {
  allowance_period: string;
  plan_key: string;
  included: number;
  commissionable: number;
  total: number;
}

async function myProviderId(): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data: provider } = await supabase
    .from("providers")
    .select("id")
    .eq("auth_user_id", auth.user.id)
    .maybeSingle();
  return (provider?.id as string | undefined) ?? null;
}

export async function listMyLeadUsage(): Promise<MyLeadUsage[]> {
  const supabase = getSupabase();
  const providerId = supabase ? await myProviderId() : null;
  if (!supabase || !providerId) return [];
  const { data, error } = await supabase
    .from("lead_ledger")
    .select("allowance_period,plan_key,allowance_status")
    .eq("provider_id", providerId)
    .order("allowance_period", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  const byPeriod = new Map<string, MyLeadUsage>();
  for (const row of data ?? []) {
    const key = row.allowance_period as string;
    const entry = byPeriod.get(key) ?? {
      allowance_period: key,
      plan_key: row.plan_key as string,
      included: 0,
      commissionable: 0,
      total: 0,
    };
    if (row.allowance_status === "included") entry.included += 1;
    else entry.commissionable += 1;
    entry.total += 1;
    byPeriod.set(key, entry);
  }
  return [...byPeriod.values()];
}

export interface JobReportRow {
  id: string;
  lead_ledger_id: string;
  provider_id: string;
  quote_request_id: string;
  outcome: JobOutcome;
  job_subtotal_cents: number;
  sales_tax_cents: number;
  refunded_cents: number;
  completed_on: string | null;
  verification_status: VerificationStatus;
  verification_note: string | null;
  reported_at: string;
}

export interface MyLeadRow {
  id: string;
  quote_request_id: string;
  plan_key: string;
  allowance_period: string;
  allowance_status: AllowanceStatus;
  counted_at: string;
  job_report_id: string | null;
  outcome: JobOutcome | null;
  verification_status: VerificationStatus | null;
}

/**
 * The contractor's counted leads, newest first, with the job report attached
 * when they have filed one. This is the single view from which they report a
 * job and see whether a lead counted against their allowance.
 */
export async function listMyLeads(): Promise<MyLeadRow[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("lead_ledger")
    .select("id,quote_request_id,plan_key,allowance_period,allowance_status,counted_at")
    .order("counted_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<Omit<MyLeadRow, "job_report_id" | "outcome" | "verification_status">>;
  if (rows.length === 0) return [];
  const { data: reports } = await supabase
    .from("job_reports")
    .select("id,lead_ledger_id,outcome,verification_status")
    .in("lead_ledger_id", rows.map((r) => r.id));
  const byLedger = new Map(
    (reports ?? []).map((r) => [
      r.lead_ledger_id as string,
      {
        id: r.id as string,
        outcome: r.outcome as JobOutcome,
        verification_status: r.verification_status as VerificationStatus,
      },
    ]),
  );
  return rows.map((row) => {
    const report = byLedger.get(row.id);
    return {
      ...row,
      job_report_id: report?.id ?? null,
      outcome: report?.outcome ?? null,
      verification_status: report?.verification_status ?? null,
    };
  });
}

export async function saveJobReport(input: {
  leadLedgerId: string;
  providerId: string;
  quoteRequestId: string;
  outcome: JobOutcome;
  jobSubtotalCents: number;
  salesTaxCents: number;
  refundedCents: number;
  completedOn: string | null;
}): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Data services are not connected yet.");
  const { error } = await supabase.from("job_reports").upsert(
    {
      lead_ledger_id: input.leadLedgerId,
      provider_id: input.providerId,
      quote_request_id: input.quoteRequestId,
      outcome: input.outcome,
      job_subtotal_cents: Math.max(0, Math.round(input.jobSubtotalCents)),
      sales_tax_cents: Math.max(0, Math.round(input.salesTaxCents)),
      refunded_cents: Math.max(0, Math.round(input.refundedCents)),
      completed_on: input.completedOn,
    },
    { onConflict: "lead_ledger_id" },
  );
  if (error) throw new Error(error.message);
}

export interface MyCommission {
  id: string;
  job_report_id: string;
  base_cents: number;
  rate_bps: number;
  amount_cents: number;
  cap_applied: boolean;
  status: CommissionStatus;
  created_at: string;
  paid_at: string | null;
  payment_reference: string | null;
  dispute_id: string | null;
  dispute_status: string | null;
}

export async function listMyCommissions(providerId?: string): Promise<MyCommission[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  let query = supabase
    .from("commissions")
    .select("id,job_report_id,base_cents,rate_bps,amount_cents,cap_applied,status,created_at,paid_at,payment_reference");
  // A shop's own totals are asked for by name, so a second business on the
  // same login can never inflate them.
  if (providerId) query = query.eq("provider_id", providerId);
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<Omit<MyCommission, "dispute_id" | "dispute_status">>;
  if (rows.length === 0) return [];
  const { data: disputes } = await supabase
    .from("commission_disputes")
    .select("id,commission_id,status")
    .in("commission_id", rows.map((r) => r.id));
  const byCommission = new Map(
    (disputes ?? []).map((d) => [d.commission_id as string, { id: d.id as string, status: d.status as string }]),
  );
  return rows.map((row) => ({
    ...row,
    dispute_id: byCommission.get(row.id)?.id ?? null,
    dispute_status: byCommission.get(row.id)?.status ?? null,
  }));
}

export async function createDispute(input: { commissionId: string; providerId: string; reason: string }): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Data services are not connected yet.");
  const { error } = await supabase.from("commission_disputes").insert({
    commission_id: input.commissionId,
    provider_id: input.providerId,
    reason: input.reason,
  });
  if (error) throw new Error(error.message);
}

/* -------------------------------------------------------------------------- */
/* Management                                                                  */
/* -------------------------------------------------------------------------- */

export async function updateCommissionSettings(input: {
  planKey: string;
  rateBps: number;
  capCents: number | null;
  includedLeads: number;
}): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Data services are not connected yet.");
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from("commission_settings").upsert(
    {
      plan_key: input.planKey,
      commission_rate_bps: input.rateBps,
      commission_cap_cents: input.capCents,
      included_leads: input.includedLeads,
      updated_at: new Date().toISOString(),
      updated_by: auth.user?.id ?? null,
    },
    { onConflict: "plan_key" },
  );
  if (error) throw new Error(error.message);
}

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
  commission_amount_cents: number | null;
  commission_status: CommissionStatus | null;
  commission_id: string | null;
}

/** Every job report, with its commission, for the verification queue. */
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
  const rows = (data ?? []) as Array<Omit<AdminJobReport, "business_name" | "commission_amount_cents" | "commission_status" | "commission_id">>;
  if (rows.length === 0) return [];
  const providerIds = [...new Set(rows.map((r) => r.provider_id))];
  const [providers, commissions] = await Promise.all([
    supabase.from("providers").select("id,business_name").in("id", providerIds),
    supabase.from("commissions").select("id,job_report_id,amount_cents,status").in("job_report_id", rows.map((r) => r.id)),
  ]);
  const nameById = new Map((providers.data ?? []).map((p) => [p.id as string, p.business_name as string]));
  const commissionByReport = new Map(
    (commissions.data ?? []).map((c) => [
      c.job_report_id as string,
      { id: c.id as string, amount_cents: c.amount_cents as number, status: c.status as CommissionStatus },
    ]),
  );
  return rows.map((row) => {
    const commission = commissionByReport.get(row.id);
    return {
      ...row,
      business_name: nameById.get(row.provider_id) ?? null,
      commission_id: commission?.id ?? null,
      commission_amount_cents: commission?.amount_cents ?? null,
      commission_status: commission?.status ?? null,
    };
  });
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

export interface AdminCommission extends MyCommission {
  business_name: string | null;
}

export async function listCommissionsForAdmin(): Promise<AdminCommission[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("commissions")
    .select("id,job_report_id,provider_id,base_cents,rate_bps,amount_cents,cap_applied,status,created_at,paid_at,payment_reference")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<Omit<AdminCommission, "business_name" | "dispute_id" | "dispute_status"> & { provider_id: string }>;
  if (rows.length === 0) return [];
  const [providers, disputes] = await Promise.all([
    supabase.from("providers").select("id,business_name").in("id", rows.map((r) => r.provider_id)),
    supabase.from("commission_disputes").select("id,commission_id,status").in("commission_id", rows.map((r) => r.id)),
  ]);
  const nameById = new Map((providers.data ?? []).map((p) => [p.id as string, p.business_name as string]));
  const disputeByCommission = new Map(
    (disputes.data ?? []).map((d) => [d.commission_id as string, { id: d.id as string, status: d.status as string }]),
  );
  return rows.map((row) => ({
    ...row,
    business_name: nameById.get(row.provider_id) ?? null,
    dispute_id: disputeByCommission.get(row.id)?.id ?? null,
    dispute_status: disputeByCommission.get(row.id)?.status ?? null,
  }));
}

/**
 * Settle a commission against a payment the provider confirmed.
 *
 * This records the reference only. It does not charge a card: the platform's
 * payment runtime has no variable-amount charge endpoint, so the money has to
 * arrive through a provider that does - a payment link, an invoice, a bank
 * transfer - and this is where its reference is kept. Marking a commission paid
 * without a reference is refused at the database level by the check below.
 */
export async function settleCommission(input: {
  commissionId: string;
  status: "payable" | "paid" | "waived" | "void";
  paymentReference?: string;
}): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Data services are not connected yet.");
  if (input.status === "paid" && !input.paymentReference?.trim()) {
    throw new Error("A payment reference is required before a commission can be marked paid.");
  }
  const { error } = await supabase
    .from("commissions")
    .update({
      status: input.status,
      payment_reference: input.paymentReference?.trim() || null,
      paid_at: input.status === "paid" ? new Date().toISOString() : null,
    })
    .eq("id", input.commissionId);
  if (error) throw new Error(error.message);
}

export interface AdminDispute {
  id: string;
  commission_id: string;
  provider_id: string;
  reason: string;
  status: "open" | "resolved" | "rejected";
  resolution_note: string | null;
  created_at: string;
  business_name: string | null;
  commission_amount_cents: number | null;
}

export async function listDisputesForAdmin(): Promise<AdminDispute[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("commission_disputes")
    .select("id,commission_id,provider_id,reason,status,resolution_note,created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<Omit<AdminDispute, "business_name" | "commission_amount_cents">>;
  if (rows.length === 0) return [];
  const [providers, commissions] = await Promise.all([
    supabase.from("providers").select("id,business_name").in("id", rows.map((r) => r.provider_id)),
    supabase.from("commissions").select("id,amount_cents").in("id", rows.map((r) => r.commission_id)),
  ]);
  const nameById = new Map((providers.data ?? []).map((p) => [p.id as string, p.business_name as string]));
  const amountById = new Map((commissions.data ?? []).map((c) => [c.id as string, c.amount_cents as number]));
  return rows.map((row) => ({
    ...row,
    business_name: nameById.get(row.provider_id) ?? null,
    commission_amount_cents: amountById.get(row.commission_id) ?? null,
  }));
}

export async function resolveDispute(input: {
  disputeId: string;
  status: "resolved" | "rejected";
  note: string;
}): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Data services are not connected yet.");
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("commission_disputes")
    .update({
      status: input.status,
      resolution_note: input.note,
      resolved_at: new Date().toISOString(),
      resolved_by: auth.user?.id ?? null,
    })
    .eq("id", input.disputeId);
  if (error) throw new Error(error.message);
}

/**
 * Flag something for fraud review, or clear it. The subject is whatever is
 * suspicious: a provider, one job report, or one commission.
 */
export async function upsertFraudReview(input: {
  subjectType: "provider" | "job_report" | "commission";
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
 * Subscriptions as the platform synced them from Stripe. This is read-only:
 * cancelling or changing a plan happens in Stripe through the customer portal,
 * and the change lands here when the provider confirms it.
 */
export async function listSubscriptionOverview(): Promise<SubscriptionRow[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("spk_payment_subscriptions")
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
