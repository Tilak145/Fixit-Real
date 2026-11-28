// What the repair screens read and write. Sending to professionals goes through
// the same marketplace jobs, prices, visits and messages the rest of FixIt uses.
import { requireSupabase } from "@/lib/supabase";
import { QUOTE_FIELDS, uploadRequestMedia, type JobQuote } from "@/lib/fixit";
import { attachmentPath, canShareWithPros, type Priority, type Repair, type RepairStatus } from "@/lib/repair-model";

const REPAIR_FIELDS =
  "id,property_id,unit_id,category_slug,title,description,priority,status,preferred_date,availability,estimated_cost_cents,final_cost_cents,quote_request_id,created_at,updated_at";

function check(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function listRepairs(organizationId: string): Promise<Repair[]> {
  const { data, error } = await requireSupabase()
    .from("maintenance_requests")
    .select(REPAIR_FIELDS)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  check(error);
  return (data ?? []) as Repair[];
}

export async function listCategories(): Promise<Array<{ slug: string; name: string }>> {
  const { data, error } = await requireSupabase().from("service_categories").select("slug,name,sort_order").order("sort_order");
  check(error);
  return (data ?? []) as Array<{ slug: string; name: string }>;
}

export interface RepairInput {
  propertyId: string;
  unitId: string;
  category: string;
  title: string;
  description: string;
  priority: Priority;
  preferredDate: string;
  availability: string;
}

function editableColumns(input: RepairInput) {
  return {
    unit_id: input.unitId || null,
    category_slug: input.category,
    title: input.title.trim(),
    description: input.description.trim(),
    priority: input.priority,
    preferred_date: input.preferredDate || null,
    availability: input.availability.trim() || null,
  };
}

export async function createRepair(organizationId: string, userId: string, input: RepairInput): Promise<string> {
  const { data, error } = await requireSupabase()
    .from("maintenance_requests")
    .insert({
      ...editableColumns(input),
      organization_id: organizationId,
      property_id: input.propertyId,
      created_by: userId,
    })
    .select("id")
    .single();
  check(error);
  return data!.id as string;
}

export async function updateRepair(id: string, input: RepairInput): Promise<void> {
  const { error } = await requireSupabase().from("maintenance_requests").update(editableColumns(input)).eq("id", id);
  check(error);
}

export async function saveFinalCost(id: string, cents: number | null): Promise<void> {
  const { error } = await requireSupabase().from("maintenance_requests").update({ final_cost_cents: cents }).eq("id", id);
  check(error);
}

export async function setRepairStatus(id: string, status: RepairStatus): Promise<void> {
  const { error } = await requireSupabase().rpc("set_repair_status", { p_request: id, p_status: status });
  check(error);
}

// ---- Files ----------------------------------------------------------------

export interface Attachment {
  id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  url: string | null;
}

export async function listAttachments(requestId: string): Promise<Attachment[]> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("maintenance_attachments")
    .select("id,storage_path,file_name,mime_type,size_bytes")
    .eq("request_id", requestId)
    .order("created_at", { ascending: true });
  check(error);
  const rows = (data ?? []) as Array<Omit<Attachment, "url">>;
  if (rows.length === 0) return [];
  const signed = await supabase.storage.from("property-files").createSignedUrls(rows.map((row) => row.storage_path), 3600);
  check(signed.error);
  return rows.map((row) => ({ ...row, url: signed.data?.find((link) => link.path === row.storage_path)?.signedUrl ?? null }));
}

export async function addAttachment(organizationId: string, userId: string, requestId: string, file: File): Promise<void> {
  const supabase = requireSupabase();
  const path = attachmentPath(organizationId, requestId, file.name);
  const upload = await supabase.storage.from("property-files").upload(path, file, { contentType: file.type });
  check(upload.error);
  const { error } = await supabase.from("maintenance_attachments").insert({
    request_id: requestId,
    organization_id: organizationId,
    storage_path: path,
    file_name: file.name.slice(-200),
    mime_type: file.type,
    size_bytes: file.size,
    uploaded_by: userId,
  });
  if (error) {
    await supabase.storage.from("property-files").remove([path]);
    throw new Error(error.message);
  }
}

export async function removeAttachment(attachment: Attachment): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.from("maintenance_attachments").delete().eq("id", attachment.id);
  check(error);
  await supabase.storage.from("property-files").remove([attachment.storage_path]);
}

// ---- Sending to professionals ---------------------------------------------

/**
 * Creates the marketplace job, then copies the chosen photos onto it, because
 * professionals can only see files attached to the job. Returns how many files
 * could not be shared; the job itself is sent either way.
 */
export async function sendToProfessionals(requestId: string, sharePhotos: boolean): Promise<{ failed: number }> {
  const supabase = requireSupabase();
  const files = sharePhotos ? (await listAttachments(requestId)).filter(canShareWithPros) : [];
  const { data: jobId, error } = await supabase.rpc("send_to_marketplace", { p_request: requestId });
  check(error);
  let failed = 0;
  for (const file of files) {
    try {
      const download = await supabase.storage.from("property-files").download(file.storage_path);
      check(download.error);
      await uploadRequestMedia({ requestId: jobId as string, file: new File([download.data!], file.file_name, { type: file.mime_type }) });
    } catch {
      failed += 1;
    }
  }
  return { failed };
}

export interface Visit {
  id: string;
  title: string;
  scheduled_for: string;
  status: string;
}

export interface MarketplaceJob {
  claimedName: string | null;
  quotes: JobQuote[];
  visits: Visit[];
}

/** The prices, chosen professional and visits on one sent repair. */
export async function getJob(jobId: string): Promise<MarketplaceJob> {
  const supabase = requireSupabase();
  const [job, quoteRead, visitRead] = await Promise.all([
    supabase.from("quote_requests").select("claimed_by").eq("id", jobId).maybeSingle(),
    supabase.from("quotes").select(QUOTE_FIELDS).eq("quote_request_id", jobId).order("created_at", { ascending: false }),
    supabase.from("appointments").select("id,title,scheduled_for,status").eq("quote_request_id", jobId).order("scheduled_for"),
  ]);
  check(job.error);
  check(quoteRead.error);
  check(visitRead.error);
  const quotes = (quoteRead.data ?? []) as JobQuote[];
  const claimed = (job.data?.claimed_by as string | null) ?? null;
  const ids = [...new Set([...quotes.map((quote) => quote.provider_id), ...(claimed ? [claimed] : [])])];
  const names = new Map<string, string>();
  const verified = new Set<string>();
  if (ids.length > 0) {
    const [providers, checks] = await Promise.all([
      supabase.from("providers").select("id,business_name").in("id", ids),
      supabase.from("provider_trust_evidence").select("provider_id,license_checked,insurance_checked").in("provider_id", ids),
    ]);
    for (const row of providers.data ?? []) names.set(row.id as string, row.business_name as string);
    for (const row of checks.data ?? []) {
      if (row.license_checked && row.insurance_checked) verified.add(row.provider_id as string);
    }
  }
  return {
    claimedName: claimed ? names.get(claimed) ?? null : null,
    quotes: quotes.map((quote) => ({
      ...quote,
      provider_name: names.get(quote.provider_id) ?? null,
      provider_verified: verified.has(quote.provider_id),
    })),
    visits: (visitRead.data ?? []) as Visit[],
  };
}

// ---- Notes and history ----------------------------------------------------

export interface Note {
  id: string;
  body: string;
  created_at: string;
}

export async function listNotes(requestId: string): Promise<Note[]> {
  const { data, error } = await requireSupabase()
    .from("maintenance_notes")
    .select("id,body,created_at")
    .eq("request_id", requestId)
    .order("created_at", { ascending: true });
  check(error);
  return (data ?? []) as Note[];
}

export async function addNote(organizationId: string, userId: string, requestId: string, body: string): Promise<void> {
  const { error } = await requireSupabase()
    .from("maintenance_notes")
    .insert({ request_id: requestId, organization_id: organizationId, author_id: userId, body: body.trim() });
  check(error);
}

export interface Activity {
  id: number;
  action: string;
  detail: string | null;
  created_at: string;
}

export async function listActivity(requestId: string): Promise<Activity[]> {
  const { data, error } = await requireSupabase()
    .from("maintenance_activity")
    .select("id,action,detail,created_at")
    .eq("request_id", requestId)
    .order("id", { ascending: false });
  check(error);
  return (data ?? []) as Activity[];
}
