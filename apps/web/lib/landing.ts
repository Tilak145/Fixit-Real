"use client";

import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/lib/auth-context";
import { landingFor } from "@/lib/landing-path";
import { getSupabase } from "@/lib/supabase";

/**
 * Whether the signed-in person has a business profile. A pro's own profile is
 * visible to them whatever its approval status, so a pro still waiting to be
 * approved counts. Throws when the database cannot be asked.
 */
export async function signedInUserIsPro(): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) return false;
  const { data, error } = await supabase.from("providers").select("id").eq("auth_user_id", user.id).maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

/**
 * The page to open after a successful sign-in: a pro's dashboard, or the page
 * that was asked for. If the check fails, the asked-for page is used, so a
 * database hiccup never stops anyone from signing in.
 */
export async function landingPath(requested = "/"): Promise<string> {
  if (requested !== "/") return requested;
  try {
    return landingFor(requested, await signedInUserIsPro());
  } catch {
    return requested;
  }
}

/** True once we know the signed-in person is a pro; false while unknown, for customers and for visitors. */
export function useIsPro(): boolean {
  const { status, user } = useAuth();
  const query = useQuery({
    queryKey: ["is-pro", user?.id],
    enabled: status === "authenticated" && !!user,
    queryFn: signedInUserIsPro,
    staleTime: 60_000,
    retry: false,
  });
  return query.data === true;
}
