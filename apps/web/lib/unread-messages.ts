"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { listUnreadMessages, type UnreadThread } from "@/lib/fixit";

export const UNREAD_MESSAGES_KEY = "unread-messages";

export interface UnreadMessages {
  /** Messages not yet read, across every conversation. */
  total: number;
  threads: UnreadThread[];
  /** The newest unread conversation, for a one-line summary. */
  latest: UnreadThread | null;
  /** Unread count for one conversation. */
  countFor(requestId: string): number;
}

/** For a signed-in person: unread messages from the other side. Checks again every 20 seconds. */
export function useUnreadMessages(enabled = true): UnreadMessages {
  const { status, user } = useAuth();
  const query = useQuery({
    queryKey: [UNREAD_MESSAGES_KEY, user?.id],
    enabled: enabled && status === "authenticated" && !!user,
    queryFn: listUnreadMessages,
    refetchInterval: 20_000,
    staleTime: 10_000,
    retry: false,
  });
  const threads = query.data ?? [];
  return {
    total: threads.reduce((sum, thread) => sum + thread.unread_count, 0),
    threads,
    latest: threads[0] ?? null,
    countFor: (requestId) => threads.find((thread) => thread.quote_request_id === requestId)?.unread_count ?? 0,
  };
}
