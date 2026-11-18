import { getSupabase } from '@/lib/supabase';
import { QUOTE_FIELDS, getRequestMedia, type Appointment, type JobQuote, type RequestMedia } from '@/lib/fixit';

/** The business a signed-in professional owns, as the app needs it. */
export interface MyBusiness {
  id: string;
  business_name: string;
  plan: string;
  rating: number;
  review_count: number;
  logo_url: string | null;
  pro_number: string | number | null;
}

/** The signed-in person's own shop, or null when this login is not a business. */
export async function getMyBusiness(userId: string): Promise<MyBusiness | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('providers')
    .select('id,business_name,plan,rating,review_count,logo_url,pro_number')
    .eq('auth_user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as MyBusiness | null) ?? null;
}

/** Whether this business is taking new work right now. Missing means on. */
export async function getAcceptingWork(userId: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return true;
  const { data, error } = await supabase.from('providers').select('accepting_work').eq('auth_user_id', userId).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.accepting_work == null ? true : Boolean(data.accepting_work);
}

/** The pause switch: off takes the business out of featured spots and ranked lists. */
export async function setAcceptingWork(userId: string, accepting: boolean): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Data services are not connected yet, so this cannot be saved.');
  const { error } = await supabase.from('providers').update({ accepting_work: accepting }).eq('auth_user_id', userId);
  if (error) throw new Error(error.message);
}

/** One request that reached this business, as this app shows it. */
export interface BusinessLead {
  id: string;
  category_slug: string;
  description: string;
  customer_name: string;
  city: string;
  status: string;
  claimed_by: string | null;
  created_at: string;
  is_emergency: boolean;
  quote: JobQuote | null;
  /** What the customer expects to spend, if they said. */
  budget_min_cents: number | null;
  budget_max_cents: number | null;
  /** Photos and a short video, each with a private link that expires. */
  media: Array<RequestMedia & { url: string | null }>;
  /**
   * The customer's phone, email and address. The database hands these over
   * only once this business's price was accepted for the job.
   */
  contact?: { phone: string | null; email: string | null; address: string | null } | null;
}

/**
 * The requests visible to this business, emergencies first. The database only
 * returns leads in the business's trades, so no filtering happens here.
 */
export async function listBusinessLeads(): Promise<BusinessLead[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('quote_requests')
    .select(
      'id,category_slug,description,customer_name,city,status,claimed_by,created_at,is_emergency,budget_min_cents,budget_max_cents',
    )
    .order('is_emergency', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<Omit<BusinessLead, 'quote' | 'media' | 'contact'>>;
  if (rows.length === 0) return [];
  const { data: quotes } = await supabase
    .from('quotes')
    .select(QUOTE_FIELDS)
    .in('quote_request_id', rows.map(row => row.id));
  const byRequest = new Map((quotes ?? []).map(quote => [(quote as JobQuote).quote_request_id, quote as JobQuote]));
  // Only the photos on jobs this business may see come back with a link.
  const media = await getRequestMedia(rows.map(row => row.id));
  const { data: contacts } = await supabase
    .from('quote_request_contacts')
    .select('quote_request_id,customer_email,customer_phone,customer_address')
    .in('quote_request_id', rows.map(row => row.id));
  const contactByRequest = new Map(
    (contacts ?? []).map(contact => [
      contact.quote_request_id as string,
      {
        phone: contact.customer_phone as string | null,
        email: contact.customer_email as string | null,
        address: contact.customer_address as string | null,
      },
    ]),
  );
  return rows.map(row => ({
    ...row,
    quote: byRequest.get(row.id) ?? null,
    media: media[row.id] ?? [],
    contact: contactByRequest.get(row.id) ?? null,
  }));
}

/**
 * Send, or revise, this business's itemised price on a job. The parts are
 * written as given and the total is their sum, so the stored price always adds
 * up. Everything else — the right trade, the job still open, nobody chosen
 * yet — is enforced by the database, so a stale screen cannot get past it.
 */
export async function sendBusinessQuote(input: {
  requestId: string;
  providerId: string;
  labourCents: number;
  materialsCents: number;
  serviceCallCents: number;
  emergencyFeeCents: number;
  otherCents: number;
  otherLabel?: string;
  earliestStart?: string;
  completionNote?: string;
  warranty?: string;
  paymentTerms?: string;
  note?: string;
}): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Sending a price is not connected yet.');
  const total =
    input.labourCents +
    input.materialsCents +
    input.serviceCallCents +
    input.emergencyFeeCents +
    input.otherCents;
  if (total <= 0) throw new Error('Enter at least one amount so the customer has a price.');
  const clean = (value?: string) => (value?.trim() ? value.trim() : null);
  const { error } = await supabase.from('quotes').upsert(
    {
      quote_request_id: input.requestId,
      provider_id: input.providerId,
      amount_cents: total,
      labour_cents: input.labourCents,
      materials_cents: input.materialsCents,
      service_call_cents: input.serviceCallCents,
      emergency_fee_cents: input.emergencyFeeCents,
      other_cents: input.otherCents,
      other_label: clean(input.otherLabel),
      earliest_start: input.earliestStart || null,
      completion_note: clean(input.completionNote),
      warranty: clean(input.warranty),
      payment_terms: clean(input.paymentTerms),
      note: clean(input.note),
      status: 'sent',
      responded_at: null,
    },
    { onConflict: 'quote_request_id,provider_id' },
  );
  if (error) throw new Error(error.message);
}

/** This business's visits. The database returns only the ones it may see. */
export async function listBusinessAppointments(): Promise<Appointment[]> {
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

