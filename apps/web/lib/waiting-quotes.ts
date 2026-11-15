"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { listMyRequests } from "@/lib/fixit";
import { countWaitingQuotes, type WaitingQuotes } from "@/lib/waiting-quotes-count";

export type { WaitingQuotes };

/** For a signed-in customer: how many prices are waiting for an answer. Checks again every 30 seconds. */
export function useWaitingQuotes(enabled: boolean): WaitingQuotes {
  const { status, user } = useAuth();
  const query = useQuery({
    queryKey: ["waiting-quotes", user?.id],
    enabled: enabled && status === "authenticated" && !!user,
    queryFn: async () => countWaitingQuotes(await listMyRequests()),
    refetchInterval: 30_000,
    staleTime: 15_000,
    retry: false,
  });
  return query.data ?? { count: 0, latest: null };
}
