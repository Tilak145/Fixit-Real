// A business's contact details, licence numbers and location are not readable
// from the providers table. The database hands them, through one function, only
// to the business itself and to FixIt staff.
import type { SupabaseClient } from "@supabase/supabase-js";

export interface ProviderPrivate {
  id: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  contact_name: string | null;
  license_number: string | null;
  license_note: string | null;
  business_registration_number: string | null;
  lat: number | null;
  lng: number | null;
}

export type PrivateField = Exclude<keyof ProviderPrivate, "id">;

/**
 * Adds the named private fields to rows already read. A row the caller may not
 * see them for gets null, never someone else's details.
 */
export async function withPrivate<T extends { id: string }, K extends PrivateField>(
  // Any client: its generated types do not know this function.
  supabase: SupabaseClient<any, any, any>,
  rows: T[],
  fields: K[],
): Promise<Array<T & Pick<ProviderPrivate, K>>> {
  if (rows.length === 0) return [];
  const { data, error } = await supabase.rpc("provider_private", { p_ids: rows.map((row) => row.id) });
  if (error) throw new Error(error.message);
  const byId = new Map(((data ?? []) as ProviderPrivate[]).map((row) => [row.id, row]));
  return rows.map((row) => {
    const extra = Object.fromEntries(fields.map((field) => [field, byId.get(row.id)?.[field] ?? null]));
    return { ...row, ...extra } as T & Pick<ProviderPrivate, K>;
  });
}
