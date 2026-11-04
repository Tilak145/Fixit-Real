import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { isPublicSupabaseConfiguration } from "@/lib/supabase";

let cached: SupabaseClient | null = null;

/**
 * Public, anonymous Supabase client for Server Components. Only public RLS
 * reads are possible with it; all user-scoped work goes through
 * requireServerSupabase with the caller's access token.
 */
export async function getServerPublicSupabase(): Promise<SupabaseClient | null> {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!isPublicSupabaseConfiguration(url, key)) return null;
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return cached;
}
