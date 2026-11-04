import "server-only";

import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

import { isPublicSupabaseConfiguration } from "@/lib/supabase";

export async function requireServerSupabase(accessToken: string) {
  if (!accessToken.trim()) throw new Error("Sign in to continue.");

  let url = process.env.SUPABASE_URL ?? "";
  let key = process.env.SUPABASE_ANON_KEY ?? "";
  if (!url || !key) {
    let script = "";
    try {
      script = await readFile("public/spk-runtime-config.js", "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    if (script) {
      // Preview updates this public configuration without restarting the app.
      // Parse its JSON assignment; never execute project-controlled JavaScript.
      const json = /^globalThis\.__SPK_RUNTIME_CONFIG__=(.*);\s*$/su.exec(script)?.[1];
      if (!json) throw new Error("Authentication configuration is invalid.");
      const config: unknown = JSON.parse(json);
      if (config && typeof config === "object") {
        const value = config as Record<string, unknown>;
        url = typeof value.supabaseUrl === "string" ? value.supabaseUrl : "";
        key = typeof value.supabaseAnonKey === "string" ? value.supabaseAnonKey : "";
      }
    }
  }
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
