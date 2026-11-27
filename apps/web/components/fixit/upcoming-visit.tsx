"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { getSupabase } from "@/lib/supabase";
import { visitWhen } from "@/lib/visit-when";

interface Visit {
  id: string;
  scheduled_for: string;
  city: string | null;
  customer_name: string | null;
  providers: { business_name: string | null } | null;
}

/**
 * A banner that cannot be missed when a visit is booked: nobody should have to
 * go looking for it. With a providerId it shows that business's next visit;
 * without one, the signed-in customer's own. It is filtered to the owner here
 * as well as in the database, because a staff account may read every visit.
 */
export function UpcomingVisit({ providerId, onView }: { providerId?: string; onView?: () => void }) {
  const { user } = useAuth();
  const visits = useQuery({
    queryKey: ["upcoming-visit", providerId ?? "customer", user?.id],
    enabled: !!user,
    refetchInterval: 30_000,
    retry: false,
    queryFn: async (): Promise<Visit[]> => {
      const supabase = getSupabase();
      if (!supabase) return [];
      // A visit stays up for two hours after its start, while it is under way.
      const since = new Date(Date.now() - 2 * 3_600_000).toISOString();
      let query = supabase
        .from("appointments")
        .select(
          providerId
            ? "id,scheduled_for,city,customer_name,providers(business_name)"
            : "id,scheduled_for,city,customer_name,providers(business_name),quote_requests!inner(customer_user_id)",
        )
        .eq("status", "scheduled")
        .gte("scheduled_for", since)
        .order("scheduled_for", { ascending: true })
        .limit(5);
      query = providerId ? query.eq("provider_id", providerId) : query.eq("quote_requests.customer_user_id", user!.id);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as Visit[];
    },
  });

  const next = visits.data?.[0];
  if (!next) return null;
  const more = visits.data!.length - 1;
  const who = providerId
    ? next.customer_name ?? "your customer"
    : next.providers?.business_name ?? "your professional";
  const action = "rounded-md bg-white px-4 py-2 text-[13px] font-bold text-[#0B4F2A] hover:bg-white/90";
  return (
    <div role="status" className="border-y border-[#0B4F2A] bg-[#157A43] text-white" data-testid="upcoming-visit">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <CalendarClock className="h-6 w-6 flex-none" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <strong className="block text-[15.5px]">You have a visit coming up: {visitWhen(next.scheduled_for)}</strong>
          <span className="block text-[13px] opacity-90">
            With {who}
            {next.city ? ` · ${next.city}` : ""}
            {more > 0 ? ` · and ${more} more after this` : ""}
          </span>
        </span>
        {onView ? (
          <button type="button" onClick={onView} className={action}>
            View visit
          </button>
        ) : (
          <Link href="/account" className={action}>
            View visit
          </Link>
        )}
      </div>
    </div>
  );
}