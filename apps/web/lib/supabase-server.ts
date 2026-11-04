import "server-only";

import { createClient } from "@supabase/supabase-js";

import { isPublicSupabaseConfiguration } from "@/lib/supabase";

export async function requireServerSupabase(accessToken: string) {
  if (!accessToken.trim()) throw new Error("Sign in to continue.");

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!isPublicSupabaseConfiguration(url, key)) {
    throw new Error("Authentication and data services are not enabled for this application.");
  }

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data.user) throw new Error("Your session could not be verified. Sign in again.");
  return { client, user: data.user };
}
