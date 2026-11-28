// Prices and visits across all of one account's sent repairs, for the overview.
import { requireSupabase } from "@/lib/supabase";
import { QUOTE_FIELDS, type JobQuote } from "@/lib/fixit";

export interface OverviewVisit {
  id: string;
  quote_request_id: string;
  title: string;
  scheduled_for: string;
  status: string;
  provider_name: string | null;
}

export async function getJobActivity(jobIds: string[]): Promise<{ quotes: JobQuote[]; visits: OverviewVisit[] }> {
  if (jobIds.length === 0) return { quotes: [], visits: [] };
  const supabase = requireSupabase();
  const [quoteRead, visitRead] = await Promise.all([
    supabase.from("quotes").select(QUOTE_FIELDS).in("quote_request_id", jobIds).in("status", ["sent", "accepted"]),
    supabase.from("appointments").select("id,quote_request_id,title,scheduled_for,status,provider_id").in("quote_request_id", jobIds),
  ]);
  if (quoteRead.error) throw new Error(quoteRead.error.message);
  if (visitRead.error) throw new Error(visitRead.error.message);
  const quotes = (quoteRead.data ?? []) as JobQuote[];
  const visits = (visitRead.data ?? []) as Array<Omit<OverviewVisit, "provider_name"> & { provider_id: string }>;
  const ids = [...new Set([...quotes.map((quote) => quote.provider_id), ...visits.map((visit) => visit.provider_id)])];
  const names = new Map<string, string>();
  if (ids.length > 0) {
    const { data } = await supabase.from("providers").select("id,business_name").in("id", ids);
    for (const row of data ?? []) names.set(row.id as string, row.business_name as string);
  }
  return {
    quotes: quotes.map((quote) => ({ ...quote, provider_name: names.get(quote.provider_id) ?? null })),
    visits: visits.map(({ provider_id, ...visit }) => ({ ...visit, provider_name: names.get(provider_id) ?? null })),
  };
}
