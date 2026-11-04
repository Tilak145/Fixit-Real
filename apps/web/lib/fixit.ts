import { getSupabase } from "@/lib/supabase";
import type { AvailabilityWindow, ProviderAvailability } from "@/lib/fixit-availability";
import type { AvailabilityFacts } from "@/lib/fixit-live-availability";

/**
 * Shapes and client-safe reads for the FixIt marketplace. A component marked
 * "use client" may import from here; Server Components use "@/lib/fixit-server"
 * for public reads, which resolves the anonymous server client.
 */

export interface ServiceCategory {
  slug: string;
  name: string;
  icon: string;
}

export interface ProSummary {
  id: string;
  business_name: string;
  description: string | null;
  city: string;
  areas?: string[];
  /** The pro's published working hours, when they have set any. */
  hours?: AvailabilityWindow[];
  /** Whether the pro is taking new work at all right now. */
  acceptingWork?: boolean;
  /** Whether the pro takes emergency and after-hours calls. */
  acceptsEmergency?: boolean;
  rating: number;
  review_count: number;
  logo_url: string | null;
  years_in_business: string | null;
  status: string;
  /** Search placement bought with the plan; lower comes first among equals. */
  placement?: number;
}

/**
 * A city FixIt serves, kept by the owner in the dashboard. The list is public,
 * and both sides of the marketplace pick from it: a customer chooses where the
 * job is, a professional chooses the areas they cover. Because it is one list,
 * an exact city match cannot fail the way free text does.
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
    .from("service_cities")
    .select("label,state,sort_order,is_active")
    .order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []) as ServiceCity[];
}

export interface Review {
  id: string;
  author_name: string;
  rating: number;
  comment: string;
  created_at: string;
}

/**
 * The availability facts for a set of professionals, keyed by provider id.
 *
 * Both the weekly hours and the work switch are public (a homeowner choosing
 * who to call may reasonably know when a pro works, and whether they are taking
 * jobs at all), so this is two bulk reads for a whole list rather than one read
 * per card. The switch defaults to on when a row has not loaded, so a missing
 * value never quietly hides a working professional.
 */
export async function getProviderAvailability(
  providerIds: string[],
): Promise<Record<string, AvailabilityFacts>> {
  const supabase = getSupabase();
  const result: Record<string, AvailabilityFacts> = {};
  if (!supabase || providerIds.length === 0) return result;

  const [{ data: providers }, { data: hours }] = await Promise.all([
    supabase.from("providers").select("id,accepts_emergency,accepting_work").in("id", providerIds),
    supabase
      .from("provider_availability")
      .select("provider_id,weekday,start_minute,end_minute")
      .in("provider_id", providerIds),
  ]);

  for (const id of providerIds) {
    result[id] = { acceptingWork: true, acceptsEmergency: false, windows: [] };
  }
  for (const row of providers ?? []) {
    const id = row.id as string;
    result[id] = {
      ...result[id],
      acceptsEmergency: Boolean(row.accepts_emergency),
      acceptingWork: row.accepting_work === null ? true : Boolean(row.accepting_work),
    };
  }
  for (const row of hours ?? []) {
    const id = row.provider_id as string;
    if (!result[id]) continue;
    result[id].windows.push({
      weekday: row.weekday as number,
      startMinute: row.start_minute as number,
      endMinute: row.end_minute as number,
    });
  }
  return result;
}

export interface MyRequest {
  id: string;
  category_slug: string;
  description: string;
  customer_name: string;
  city: string;
  status: "new" | "claimed" | "completed";
  claimed_by: string | null;
  created_at: string;
  /** The customer flagged this job as one that cannot wait. */
  is_emergency?: boolean;
  provider_name?: string | null;
  /** The prices professionals have sent on this request, newest first. */
  quotes?: JobQuote[];
}

/**
 * The signed-in customer's own quote requests, newest first. Reads through the
 * browser session: Row Level Security lets a customer see only rows whose
 * customer_user_id is their own id.
 */
export async function listMyRequests(): Promise<MyRequest[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("quote_requests")
    .select("id,category_slug,description,customer_name,city,status,claimed_by,is_emergency,created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as MyRequest[];
  const claimedIds = Array.from(
    new Set(rows.map((row) => row.claimed_by).filter((value): value is string => Boolean(value))),
  );
  if (claimedIds.length === 0) return rows;
  const { data: providers } = await supabase
    .from("providers")
    .select("id,business_name")
    .in("id", claimedIds);
  const nameById = new Map((providers ?? []).map((row) => [row.id as string, row.business_name as string]));
  const withNames = rows.map((row) => ({
    ...row,
    provider_name: row.claimed_by ? nameById.get(row.claimed_by) ?? null : null,
  }));

  // The quotes on these requests. Row Level Security returns the customer's own,
  // so this is one extra read for the whole page rather than one per card, which
  // is what lets a card show a price waiting on an answer without a round trip.
  if (withNames.length === 0) return withNames;
  const { data: quotes } = await supabase
    .from("quotes")
    .select(QUOTE_FIELDS)
    .in("quote_request_id", withNames.map((row) => row.id))
    .order("created_at", { ascending: false });
  const quotesByRequest = new Map<string, JobQuote[]>();
  for (const row of (quotes ?? []) as JobQuote[]) {
    const list = quotesByRequest.get(row.quote_request_id) ?? [];
    list.push({ ...row, provider_name: nameById.get(row.provider_id) ?? null });
    quotesByRequest.set(row.quote_request_id, list);
  }
  return withNames.map((row) => ({ ...row, quotes: quotesByRequest.get(row.id) ?? [] }));
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
  /**
   * The customer's contact details and service address. These come from the
   * contacts table, which the database only releases to the professional who
   * accepted the lead (and to the customer on their own job), so they stay
   * null on anything the caller is not entitled to see.
   */
  customer_email?: string | null;
  customer_phone?: string | null;
  customer_address?: string | null;
}

export interface Message {
  id: string;
  quote_request_id: string;
  sender_role: "customer" | "provider";
  body: string;
  created_at: string;
}

/** Upcoming visits, soonest first. Row Level Security scopes this to the caller. */
export async function listMyAppointments(): Promise<Appointment[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("appointments")
    .select("id,quote_request_id,title,customer_name,city,scheduled_for,status,notes")
    .order("scheduled_for", { ascending: true })
    .limit(50);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Appointment[];

  // Attach the customer's contact details and address for the jobs the caller
  // may see. The database hands back only the rows this caller is entitled to,
  // so a visit they cannot see simply has no contact entry.
  const requestIds = [...new Set(rows.map((r) => r.quote_request_id).filter((id): id is string => !!id))];
  if (requestIds.length === 0) return rows;
  const { data: contacts } = await supabase
    .from("quote_request_contacts")
    .select("quote_request_id,customer_email,customer_phone,customer_address")
    .in("quote_request_id", requestIds);
  const byRequest = new Map(
    (contacts ?? []).map((c) => [
      c.quote_request_id as string,
      {
        customer_email: c.customer_email as string | null,
        customer_phone: c.customer_phone as string | null,
        customer_address: c.customer_address as string | null,
      },
    ]),
  );
  return rows.map((row) => (row.quote_request_id ? { ...row, ...(byRequest.get(row.quote_request_id) ?? {}) } : row));
}

/** One photo or video a customer sent with a job. */
export interface RequestMedia {
  id: string;
  quote_request_id: string;
  kind: "photo" | "video";
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
}

/** A ceiling that keeps a phone photo or a short clip comfortably inside it. */
const MAX_MEDIA_BYTES = 25 * 1024 * 1024;

/** What a customer may attach: a still, or one short clip. */
export const MEDIA_ACCEPT = "image/*,video/mp4,video/quicktime,video/webm";

export function mediaKindFor(file: { type: string }): "photo" | "video" | null {
  if (file.type.startsWith("image/")) return "photo";
  if (file.type.startsWith("video/")) return "video";
  return null;
}

/**
 * Store one photo or video for a job and record it. The file lives under the
 * request's own id, which is exactly what the storage rules check, so a
 * customer can only add media to their own request and nobody can read a job
 * photo they are not entitled to.
 */
export async function uploadRequestMedia(input: {
  requestId: string;
  file: File;
}): Promise<RequestMedia> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Data services are not connected yet, so the file cannot be saved.");
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Please sign in first so your photos are kept with your request.");

  const kind = mediaKindFor(input.file);
  if (!kind) throw new Error("Please choose a photo or a video.");
  if (input.file.size > MAX_MEDIA_BYTES) {
    throw new Error("That file is larger than 25 MB. Please choose a smaller file or a shorter clip.");
  }
  if (kind === "video" && input.file.size > 15 * 1024 * 1024) {
    throw new Error("That video is over 15 MB. A short clip is plenty — try trimming it.");
  }

  const safeName = input.file.name.replace(/[^A-Za-z0-9._-]/g, "_").slice(-80) || kind;
  const path = input.requestId + "/" + Date.now() + "-" + safeName;
  const { error: uploadError } = await supabase.storage
    .from("request-media")
    .upload(path, input.file, { contentType: input.file.type || undefined });
  if (uploadError) throw new Error(uploadError.message);

  const { data, error } = await supabase
    .from("quote_request_media")
    .insert({
      quote_request_id: input.requestId,
      uploaded_by: auth.user.id,
      kind,
      storage_path: path,
      file_name: input.file.name,
      mime_type: input.file.type || null,
      size_bytes: input.file.size,
    })
    .select("id,quote_request_id,kind,storage_path,file_name,mime_type,size_bytes,created_at")
    .single();
  if (error) throw new Error(error.message);
  return data as RequestMedia;
}

/** Remove one attachment, so a customer can take back a photo they did not mean to send. */
export async function deleteRequestMedia(media: RequestMedia): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Data services are not connected yet.");
  const { error: storageError } = await supabase.storage.from("request-media").remove([media.storage_path]);
  if (storageError) throw new Error(storageError.message);
  const { error } = await supabase.from("quote_request_media").delete().eq("id", media.id);
  if (error) throw new Error(error.message);
}

/**
 * The media on a set of requests, keyed by request id, each with a short-lived
 * private link. The bucket is not public, so a URL has to be signed and only a
 * reader the storage rules allow can obtain one.
 */
export async function getRequestMedia(
  requestIds: string[],
): Promise<Record<string, Array<RequestMedia & { url: string | null }>>> {
  const supabase = getSupabase();
  const result: Record<string, Array<RequestMedia & { url: string | null }>> = {};
  if (!supabase || requestIds.length === 0) return result;
  const { data, error } = await supabase
    .from("quote_request_media")
    .select("id,quote_request_id,kind,storage_path,file_name,mime_type,size_bytes,created_at")
    .in("quote_request_id", requestIds)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as RequestMedia[];
  // One signed request for every file rather than one call each, which would be
  // a round trip per photo on a page full of jobs.
  const paths = rows.map((row) => row.storage_path);
  const signed = new Map<string, string>();
  if (paths.length > 0) {
    const { data: links } = await supabase.storage.from("request-media").createSignedUrls(paths, 60 * 60);
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

export type QuoteStatus = "sent" | "accepted" | "declined" | "withdrawn";

/**
 * The price a professional offered on one request. Contact details are not
 * released when the pro claims the lead, only when the customer accepts one of
 * these, so the quote is the step that actually agrees the work. Both sides read
 * their quotes alongside the requests they belong to, so there is no single-
 * request reader here.
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
  /** When the professional can start, and how long they expect it to take. */
  earliest_start: string | null;
  completion_note: string | null;
  warranty: string | null;
  payment_terms: string | null;
  valid_until: string | null;
  note: string | null;
  status: QuoteStatus;
  created_at: string;
  responded_at: string | null;
  provider_name?: string | null;
}

/**
 * Every column a quote read needs, so the two sides can never drift apart. It is
 * one literal, not a concatenation, so the typed client still reads the columns
 * from it.
 */
export const QUOTE_FIELDS = "id,quote_request_id,provider_id,amount_cents,labour_cents,materials_cents,service_call_cents,emergency_fee_cents,other_cents,other_label,earliest_start,completion_note,warranty,payment_terms,valid_until,note,status,created_at,responded_at";

export interface QuoteDraft {
  /** The parts of the price, in whole cents. */
  labourCents: number;
  materialsCents: number;
  serviceCallCents: number;
  emergencyFeeCents: number;
  otherCents: number;
  otherLabel?: string | null;
  earliestStart?: string | null;
  completionNote?: string | null;
  warranty?: string | null;
  paymentTerms?: string | null;
  validUntil?: string | null;
  note?: string | null;
}

/** The total of a draft, which is what the customer compares first. */
export function quoteTotalCents(draft: QuoteDraft): number {
  return (
    draft.labourCents +
    draft.materialsCents +
    draft.serviceCallCents +
    draft.emergencyFeeCents +
    draft.otherCents
  );
}

/**
 * The professional sends, or revises, their itemised price on a lead they
 * matched. The parts are written as given and the total is their sum, so the
 * stored quote always satisfies the database's rule that the parts add up.
 */
export async function sendQuote(input: { requestId: string; draft: QuoteDraft }): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Quoting is not connected yet.");
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Please sign in to your provider account first.");
  const { data: provider, error: providerError } = await supabase
    .from("providers")
    .select("id")
    .eq("auth_user_id", auth.user.id)
    .maybeSingle();
  if (providerError) throw new Error(providerError.message);
  if (!provider) throw new Error("Your provider profile was not found. Finish onboarding first.");

  const total = quoteTotalCents(input.draft);
  if (total <= 0) throw new Error("Enter at least one amount so the customer has a price.");

  const { error } = await supabase.from("quotes").upsert(
    {
      quote_request_id: input.requestId,
      provider_id: provider.id,
      amount_cents: total,
      labour_cents: input.draft.labourCents,
      materials_cents: input.draft.materialsCents,
      service_call_cents: input.draft.serviceCallCents,
      emergency_fee_cents: input.draft.emergencyFeeCents,
      other_cents: input.draft.otherCents,
      other_label: input.draft.otherLabel?.trim() || null,
      earliest_start: input.draft.earliestStart || null,
      completion_note: input.draft.completionNote?.trim() || null,
      warranty: input.draft.warranty?.trim() || null,
      payment_terms: input.draft.paymentTerms?.trim() || null,
      valid_until: input.draft.validUntil || null,
      note: input.draft.note?.trim() || null,
      status: "sent",
      responded_at: null,
    },
    { onConflict: "quote_request_id,provider_id" },
  );
  if (error) throw new Error(error.message);
}

/** The customer accepts or declines the price a professional sent. */
export async function respondToQuote(input: {
  quoteId: string;
  response: "accepted" | "declined";
}): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Quoting is not connected yet.");
  const { error } = await supabase
    .from("quotes")
    .update({ status: input.response })
    .eq("id", input.quoteId)
    .eq("status", "sent");
  if (error) throw new Error(error.message);
}

/** The message thread for one quote request, oldest first. */
export async function listMessages(requestId: string): Promise<Message[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("messages")
    .select("id,quote_request_id,sender_role,body,created_at")
    .eq("quote_request_id", requestId)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []) as Message[];
}

/**
 * Post to a thread as the customer or as the claiming professional. The
 * database refuses a message written for the other side, so the role here is a
 * statement of who is typing, not a permission.
 */
export async function sendMessage(input: {
  requestId: string;
  role: "customer" | "provider";
  body: string;
}): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Messaging is not connected yet.");
  const { data } = await supabase.auth.getUser();
  const { error } = await supabase.from("messages").insert({
    quote_request_id: input.requestId,
    sender_role: input.role,
    sender_user_id: data.user?.id ?? null,
    body: input.body.trim(),
  });
  if (error) throw new Error(error.message);
}

export interface CustomerProfile {
  full_name: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
}

/**
 * The customer's six-digit number, as a string so a leading zero would survive
 * and so "0488543" never reads as a shorter number when spoken. Null until the
 * database has allocated one, which the account page shows as "assigned shortly".
 */
export async function getMyCustomerNumber(): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await supabase
    .from("customer_profiles")
    .select("customer_number")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const number = data?.customer_number as number | null | undefined;
  return number ? String(number).padStart(6, "0") : null;
}

/**
 * The signed-in customer's saved details. The account is the source of truth
 * (it is written at sign-up, before any session exists); the table mirrors it
 * so the database can hand the address to a professional through the lead.
 */
export async function getMyProfile(): Promise<CustomerProfile | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data: auth } = await supabase.auth.getUser();
  const meta = auth.user?.user_metadata ?? {};
  const fromAccount: CustomerProfile = {
    full_name: (meta.full_name as string | undefined) ?? null,
    phone: (meta.phone as string | undefined) ?? null,
    address: (meta.address as string | undefined) ?? null,
    city: (meta.city as string | undefined) ?? null,
  };
  const { data } = await supabase
    .from("customer_profiles")
    .select("full_name,phone,address,city")
    .eq("user_id", auth.user?.id ?? "")
    .maybeSingle();
  return {
    full_name: (data?.full_name as string | null) ?? fromAccount.full_name,
    phone: (data?.phone as string | null) ?? fromAccount.phone,
    address: (data?.address as string | null) ?? fromAccount.address,
    city: (data?.city as string | null) ?? fromAccount.city,
  };
}

/** Save the customer's details to both the account and the mirrored table. */
export async function saveMyProfile(profile: CustomerProfile): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Data services are not connected yet.");
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Sign in first.");
  const clean = {
    full_name: profile.full_name?.trim() || null,
    phone: profile.phone?.trim() || null,
    address: profile.address?.trim() || null,
    city: profile.city?.trim() || null,
  };
  const { error: metaError } = await supabase.auth.updateUser({ data: clean });
  if (metaError) throw new Error(metaError.message);
  const { error } = await supabase
    .from("customer_profiles")
    .upsert({ user_id: auth.user.id, ...clean, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

export interface MyReview {
  id: string;
  provider_id: string;
  rating: number;
  comment: string;
  created_at: string;
  provider_name?: string | null;
}

/** Reviews this customer has written, newest first. */
export async function listMyReviews(): Promise<MyReview[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];
  const { data, error } = await supabase
    .from("reviews")
    .select("id,provider_id,rating,comment,created_at")
    .eq("author_user_id", auth.user.id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as MyReview[];
  const ids = Array.from(new Set(rows.map((r) => r.provider_id)));
  if (ids.length === 0) return rows;
  const { data: providers } = await supabase.from("providers").select("id,business_name").in("id", ids);
  const nameById = new Map((providers ?? []).map((p) => [p.id as string, p.business_name as string]));
  return rows.map((row) => ({ ...row, provider_name: nameById.get(row.provider_id) ?? null }));
}

export interface HistoryEntry {
  id: string;
  kind: "request" | "visit" | "review";
  title: string;
  detail: string;
  /** ISO timestamp the entry is ordered by. */
  at: string;
  status?: string;
}

/**
 * Everything this customer has done with professionals, newest first: the jobs
 * they asked for, the visits booked and the reviews they left. Built from the
 * reads above so the account page shows one timeline rather than three lists.
 */
export async function listMyHistory(): Promise<HistoryEntry[]> {
  const [requests, appointments, reviews] = await Promise.all([
    listMyRequests(),
    listMyAppointments(),
    listMyReviews(),
  ]);
  const entries: HistoryEntry[] = [
    ...requests.map((r) => ({
      id: `request-${r.id}`,
      kind: "request" as const,
      title: r.category_slug.replace(/-/g, " "),
      detail: r.provider_name ? `${r.city} · ${r.provider_name}` : r.city,
      at: r.created_at,
      status: r.status,
    })),
    ...appointments.map((a) => ({
      id: `visit-${a.id}`,
      kind: "visit" as const,
      title: a.title,
      detail: `${a.city}${a.notes ? ` · ${a.notes}` : ""}`,
      at: a.scheduled_for,
      status: a.status,
    })),
    ...reviews.map((r) => ({
      id: `review-${r.id}`,
      kind: "review" as const,
      title: r.provider_name ? `Review of ${r.provider_name}` : "Review left",
      detail: `${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}${r.comment ? ` · ${r.comment}` : ""}`,
      at: r.created_at,
    })),
  ];
  return entries.sort((a, b) => (a.at < b.at ? 1 : -1));
}

export type ProviderDocumentKind = "photo_id" | "insurance";

export interface ProviderDocument {
  kind: ProviderDocumentKind;
  file_name: string;
  storage_path: string;
  uploaded_at: string;
}

/**
 * The documents a professional uploaded during onboarding (photo ID, insurance
 * certificate), keyed by slot. Reads only the caller's own rows.
 */
export async function listMyDocuments(): Promise<Record<ProviderDocumentKind, ProviderDocument | null>> {
  const empty = { photo_id: null, insurance: null };
  const supabase = getSupabase();
  if (!supabase) return empty;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return empty;
  const { data, error } = await supabase
    .from("provider_documents")
    .select("kind,file_name,storage_path,uploaded_at")
    .eq("auth_user_id", auth.user.id);
  if (error) throw new Error(error.message);
  const result: Record<ProviderDocumentKind, ProviderDocument | null> = { ...empty };
  for (const row of (data ?? []) as Array<ProviderDocument & { kind: ProviderDocumentKind }>) {
    result[row.kind] = {
      kind: row.kind,
      file_name: row.file_name,
      storage_path: row.storage_path,
      uploaded_at: row.uploaded_at,
    };
  }
  return result;
}

/** A ceiling that keeps a phone photo of a document comfortably inside it. */
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

/**
 * Store one onboarding document in the private bucket and record it. The path
 * is scoped by the caller's own user id, which is exactly what the storage
 * rules check, so one professional can never write over another's file.
 */
export async function uploadProviderDocument(kind: ProviderDocumentKind, file: File): Promise<ProviderDocument> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Data services are not connected yet, so the document cannot be saved.");
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Please create your provider account first.");
  if (file.size > MAX_DOCUMENT_BYTES) throw new Error("That file is larger than 10 MB. Please choose a smaller file.");

  const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, "_").slice(-80) || "document";
  const storage_path = `${auth.user.id}/${kind}/${Date.now()}-${safeName}`;
  const { error: uploadError } = await supabase.storage
    .from("provider-documents")
    .upload(storage_path, file, { upsert: true, contentType: file.type || undefined });
  if (uploadError) throw new Error(uploadError.message);

  const { error: recordError } = await supabase.from("provider_documents").upsert(
    {
      auth_user_id: auth.user.id,
      kind,
      storage_path,
      file_name: file.name,
      mime_type: file.type || null,
      size_bytes: file.size,
      uploaded_at: new Date().toISOString(),
    },
    { onConflict: "auth_user_id,kind" },
  );
  if (recordError) throw new Error(recordError.message);

  return { kind, file_name: file.name, storage_path, uploaded_at: new Date().toISOString() };
}

/** A logo has to fit a card image, so keep it well under a few megabytes. */
const MAX_LOGO_BYTES = 4 * 1024 * 1024;

/**
 * Store a business logo in the public logo bucket and hand back the public URL
 * to save on the provider row. The path is scoped by the uploader's user id,
 * which is what the storage rules check, so one business can never write over
 * another's logo. A fresh file name each time avoids a stale cached image when
 * the same logo is replaced.
 */
export async function uploadProviderLogo(file: File): Promise<string> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Data services are not connected yet, so the logo cannot be saved.");
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Please sign in to your provider account first.");
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file for your logo.");
  if (file.size > MAX_LOGO_BYTES) throw new Error("That image is larger than 4 MB. Please choose a smaller one.");

  const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, "_").slice(-60) || "logo";
  const storage_path = `${auth.user.id}/${Date.now()}-${safeName}`;
  const { error: uploadError } = await supabase.storage
    .from("provider-logos")
    .upload(storage_path, file, { upsert: true, contentType: file.type || undefined });
  if (uploadError) throw new Error(uploadError.message);

  const { data } = supabase.storage.from("provider-logos").getPublicUrl(storage_path);
  if (!data?.publicUrl) throw new Error("The logo uploaded, but its address could not be read.");
  return data.publicUrl;
}

/** A short-lived private link, valid only for a reader the storage rules allow. */
export async function documentSignedUrl(storagePath: string): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.storage
    .from("provider-documents")
    .createSignedUrl(storagePath, 60 * 10);
  if (error) return null;
  return data?.signedUrl ?? null;
}

/**
 * A professional's weekly hours and their emergency opt-in, for their own
 * dashboard. Reads only the row the caller owns.
 */
export async function getMyAvailability(): Promise<ProviderAvailability> {
  const empty: ProviderAvailability = { acceptsEmergency: false, acceptingWork: true, windows: [] };
  const supabase = getSupabase();
  if (!supabase) return empty;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return empty;

  const { data: provider, error: providerError } = await supabase
    .from("providers")
    .select("id,accepts_emergency,accepting_work")
    .eq("auth_user_id", auth.user.id)
    .maybeSingle();
  if (providerError) throw new Error(providerError.message);
  if (!provider) return empty;

  const { data, error } = await supabase
    .from("provider_availability")
    .select("weekday,start_minute,end_minute")
    .eq("provider_id", provider.id)
    .order("weekday", { ascending: true });
  if (error) throw new Error(error.message);

  return {
    acceptsEmergency: Boolean(provider.accepts_emergency),
    // Absent only if the column has not loaded yet; default to on so a missing
    // value never silently takes a working pro out of the rotation.
    acceptingWork: provider.accepting_work === null ? true : Boolean(provider.accepting_work),
    windows: (data ?? []).map((row) => ({
      weekday: row.weekday as number,
      startMinute: row.start_minute as number,
      endMinute: row.end_minute as number,
    })),
  };
}

/**
 * Flip the professional's work switch. This is the one control they reach for
 * when they get busy, so it is a single column write that takes effect on the
 * next read — no reload, no resubmitting their hours.
 */
export async function setAcceptingWork(accepting: boolean): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Data services are not connected yet, so this cannot be saved.");
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Please sign in to your provider account first.");
  const { error } = await supabase
    .from("providers")
    .update({ accepting_work: accepting })
    .eq("auth_user_id", auth.user.id);
  if (error) throw new Error(error.message);
}

/**
 * Replace the whole week and the emergency opt-in in one save. The week is
 * small and edited as a whole, so writing it as one unit keeps what the pro
 * sees on screen and what is stored in step.
 */
export async function saveMyAvailability(input: ProviderAvailability): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Data services are not connected yet, so your hours cannot be saved.");
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Please sign in to your provider account first.");

  const { data: provider, error: providerError } = await supabase
    .from("providers")
    .select("id")
    .eq("auth_user_id", auth.user.id)
    .maybeSingle();
  if (providerError) throw new Error(providerError.message);
  if (!provider) throw new Error("Your provider profile was not found. Finish onboarding first.");

  // The emergency opt-in and the work switch are saved with the week, so one
  // save leaves the pro in exactly the state they can see on screen.
  const { error: flagError } = await supabase
    .from("providers")
    .update({ accepts_emergency: input.acceptsEmergency, accepting_work: input.acceptingWork })
    .eq("id", provider.id);
  if (flagError) throw new Error(flagError.message);

  const { error: clearError } = await supabase
    .from("provider_availability")
    .delete()
    .eq("provider_id", provider.id);
  if (clearError) throw new Error(clearError.message);

  if (input.windows.length === 0) return;
  const { error: insertError } = await supabase.from("provider_availability").insert(
    input.windows.map((w) => ({
      provider_id: provider.id,
      weekday: w.weekday,
      start_minute: w.startMinute,
      end_minute: w.endMinute,
    })),
  );
  if (insertError) throw new Error(insertError.message);
}
