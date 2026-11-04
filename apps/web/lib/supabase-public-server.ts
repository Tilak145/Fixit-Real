import "server-only";

import { readFile } from "node:fs/promises";
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
  let url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  let key = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!url || !key) {
    let script = "";
    try {
      script = await readFile("public/spk-runtime-config.js", "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    const json = /^globalThis\.__SPK_RUNTIME_CONFIG__=(.*);\s*$/su.exec(script)?.[1];
    if (json) {
      const config: unknown = JSON.parse(json);
      if (config && typeof config === "object") {
        const value = config as Record<string, unknown>;
        url = typeof value.supabaseUrl === "string" ? value.supabaseUrl : "";
        key = typeof value.supabaseAnonKey === "string" ? value.supabaseAnonKey : "";
      }
    }
  }
  if (!isPublicSupabaseConfiguration(url, key)) return null;
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return cached;
}
