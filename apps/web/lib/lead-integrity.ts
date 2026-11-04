/**
 * Lead integrity: the two things management does with a bad request.
 *
 * A request can be flagged by the screening rules when it looks like a
 * duplicate, a test or a bot, and a professional can report a lead that turned
 * out to be fake, twice-posted or outside their trade. Both wait for a person:
 * a flagged request is withheld from professionals until it is cleared, and a
 * report is answered with a decision. Nothing here is automatic, because
 * deciding a real customer is fake is not something a rule should do.
 */

import { getSupabase } from "@/lib/supabase";

export type FlagSeverity = "note" | "suspicious";
export type FlagStatus = "open" | "cleared" | "confirmed";
export type DisputeReason =
  | "fake"
  | "duplicate"
  | "out_of_area"
  | "wrong_trade"
  | "already_done"
  | "unreachable"
  | "other";
export type DisputeStatus = "open" | "upheld" | "rejected";

export interface LeadFlagRow {
  id: string;
  quote_request_id: string;
  reason: string;
  severity: FlagSeverity;
  status: FlagStatus;
  note: string | null;
  created_at: string;
  // Joined for display, so the reviewer sees the job, not just an id.
  category_slug: string | null;
  description: string | null;
  customer_name: string | null;
  city: string | null;
}

export interface LeadDisputeRow {
  id: string;
  quote_request_id: string;
  provider_id: string;
  reason: DisputeReason;
  detail: string | null;
  status: DisputeStatus;
  decision_note: string | null;
  created_at: string;
  business_name: string | null;
  category_slug: string | null;
  customer_name: string | null;
  city: string | null;
}

export const DISPUTE_REASON_LABELS: Record<DisputeReason, string> = {
  fake: "Looks fake or a test",
  duplicate: "Seen this job before",
  out_of_area: "Outside the service area",
  wrong_trade: "Not the trade it says",
  already_done: "Job already done",
  unreachable: "Customer unreachable",
  other: "Something else",
};

export async function listLeadFlags(): Promise<LeadFlagRow[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("lead_flags")
    .select("id,quote_request_id,reason,severity,status,note,created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<Omit<LeadFlagRow, "category_slug" | "description" | "customer_name" | "city">>;
  if (rows.length === 0) return [];
  const { data: requests } = await supabase
    .from("quote_requests")
    .select("id,category_slug,description,customer_name,city")
    .in("id", Array.from(new Set(rows.map((r) => r.quote_request_id))));
  const byId = new Map((requests ?? []).map((q) => [q.id as string, q]));
  return rows.map((row) => {
    const q = byId.get(row.quote_request_id);
    return {
      ...row,
      category_slug: (q?.category_slug as string) ?? null,
      description: (q?.description as string) ?? null,
      customer_name: (q?.customer_name as string) ?? null,
      city: (q?.city as string) ?? null,
    };
  });
}

export async function resolveLeadFlag(input: {
  flagId: string;
  status: FlagStatus;
  note?: string;
}): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Data services are not connected yet.");
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("lead_flags")
    .update({
      status: input.status,
      note: input.note ?? null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: auth.user?.id ?? null,
    })
    .eq("id", input.flagId);
  if (error) throw new Error(error.message);
}

export async function listLeadDisputes(): Promise<LeadDisputeRow[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("lead_disputes")
    .select("id,quote_request_id,provider_id,reason,detail,status,decision_note,created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<Omit<LeadDisputeRow, "business_name" | "category_slug" | "customer_name" | "city">>;
  if (rows.length === 0) return [];
  const [providers, requests] = await Promise.all([
    supabase.from("providers").select("id,business_name").in("id", Array.from(new Set(rows.map((r) => r.provider_id)))),
    supabase
      .from("quote_requests")
      .select("id,category_slug,customer_name,city")
      .in("id", Array.from(new Set(rows.map((r) => r.quote_request_id)))),
  ]);
  const nameById = new Map((providers.data ?? []).map((p) => [p.id as string, p.business_name as string]));
  const reqById = new Map((requests.data ?? []).map((q) => [q.id as string, q]));
  return rows.map((row) => {
    const q = reqById.get(row.quote_request_id);
    return {
      ...row,
      business_name: nameById.get(row.provider_id) ?? null,
      category_slug: (q?.category_slug as string) ?? null,
      customer_name: (q?.customer_name as string) ?? null,
      city: (q?.city as string) ?? null,
    };
  });
}

export async function resolveLeadDispute(input: {
  disputeId: string;
  status: "upheld" | "rejected";
  note: string;
}): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Data services are not connected yet.");
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("lead_disputes")
    .update({
      status: input.status,
      decision_note: input.note,
      reviewed_at: new Date().toISOString(),
      reviewed_by: auth.user?.id ?? null,
    })
    .eq("id", input.disputeId);
  if (error) throw new Error(error.message);
}

