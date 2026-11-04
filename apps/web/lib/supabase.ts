import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type RuntimeConfig = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

let client: SupabaseClient | null = null;

export function isPublicSupabaseConfiguration(url: string, key: string): boolean {
  if (!key) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ||
      (parsed.protocol === "http:" &&
        (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1"));
  } catch {
    return false;
  }
}

// Resolve at use time: this module can load before the public config script.
// Missing configuration must not permanently cache an unavailable client.
function publicConfiguration(): { url: string; key: string } {
  const config =
    (globalThis as typeof globalThis & { __SPK_RUNTIME_CONFIG__?: RuntimeConfig })
      .__SPK_RUNTIME_CONFIG__ ?? {};
  return {
    url: config.supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    key: config.supabaseAnonKey ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  };
}

export function getSupabase(): SupabaseClient | null {
  if (client) return client;
  const { url, key } = publicConfiguration();
  if (!isPublicSupabaseConfiguration(url, key)) return null;
  client = createClient(url, key);
  return client;
}

/**
 * The REST root, which serves PostgREST's own description of every table.
 * Reading a table's shape from it is the only way to offer a form for a table
 * that has no rows yet to read the shape from.
 */
export function supabaseRestRoot(): { url: string; key: string } | null {
  const resolved = publicConfiguration();
  if (!isPublicSupabaseConfiguration(resolved.url, resolved.key)) return null;
  return { url: `${resolved.url.replace(/\/$/u, "")}/rest/v1/`, key: resolved.key };
}

export function requireSupabase(): SupabaseClient {
  const resolved = getSupabase();
  if (!resolved) throw new Error("Authentication and data services are not enabled for this application.");
  return resolved;
}
