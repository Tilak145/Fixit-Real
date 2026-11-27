"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { getSupabase } from "@/lib/supabase";
import { useUnreadMessages } from "@/lib/unread-messages";
import { useWaitingQuotes } from "@/lib/waiting-quotes";

export interface BellItem {
  key: string;
  title: string;
  /** What it says. */
  body: string;
  /** How many messages this line stands for. */
  count: number;
  onOpen: () => void;
}

/**
 * The bell at the top right: a number for what is waiting, and on click, what
 * each one says. Messages and FixIt's decisions are found here; a page can add
 * its own lines (the pro dashboard adds answers to quotes and new leads).
 */
export function NotificationBell({
  customer = false,
  home,
  extra = [],
  onOpenMessages,
}: {
  /** Also count prices waiting for this customer. */
  customer?: boolean;
  /** Where a line leads when the page gives nothing better. */
  home: string;
  extra?: BellItem[];
  onOpenMessages?: () => void;
}) {
  const router = useRouter();
  const { status, user } = useAuth();
  const signedIn = status === "authenticated";
  const unread = useUnreadMessages(signedIn);
  const waiting = useWaitingQuotes(signedIn && customer);
  // The database returns only the signed-in business's own notices.
  const notices = useQuery({
    queryKey: ["bell-notices", user?.id],
    enabled: signedIn,
    refetchInterval: 10_000,
    retry: false,
    queryFn: async () => {
      const supabase = getSupabase();
      if (!supabase) return [];
      const { data, error } = await supabase
        .from("provider_notices")
        .select("id,title,body")
        .is("read_at", null)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw new Error(error.message);
      return (data ?? []) as Array<{ id: string; title: string; body: string }>;
    },
  });

  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  const go = () => router.push(home);
  const items: BellItem[] = [
    ...unread.threads.map((thread) => ({
      key: `message-${thread.quote_request_id}`,
      title:
        thread.unread_count === 1
          ? `Message from your ${thread.last_sender_role === "provider" ? "pro" : "customer"}`
          : `${thread.unread_count} messages from your ${thread.last_sender_role === "provider" ? "pro" : "customer"}`,
      body: thread.last_body,
      count: thread.unread_count,
      onOpen: onOpenMessages ?? go,
    })),
    ...(waiting.count > 0
      ? [
          {
            key: "prices",
            title: waiting.count === 1 ? "You have a new price" : `You have ${waiting.count} new prices`,
            body: waiting.latest
              ? `$${(waiting.latest.amountCents / 100).toFixed(2)}${waiting.latest.providerName ? ` from ${waiting.latest.providerName}` : ""}`
              : "Open your account to see it.",
            count: waiting.count,
            onOpen: go,
          },
        ]
      : []),
    ...(notices.data ?? []).map((notice) => ({
      key: `notice-${notice.id}`,
      title: notice.title,
      body: notice.body,
      count: 1,
      onOpen: go,
    })),
    ...extra,
  ];
  const total = items.reduce((sum, item) => sum + item.count, 0);

  if (!signedIn) return null;
  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-label={`Notifications (${total} new)`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="relative grid h-10 w-10 place-items-center rounded-full border border-border bg-card text-foreground/70 hover:border-primary hover:text-primary"
      >
        <Bell className="h-[18px] w-[18px]" aria-hidden="true" />
        {total > 0 ? (
          <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#E4574C] px-1 text-[11px] font-bold text-white">
            {total > 99 ? "99+" : total}
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="Notifications"
          className="fixed right-3 top-[72px] z-[70] max-h-[70vh] w-[min(340px,calc(100vw-24px))] overflow-y-auto rounded-xl border border-border bg-card text-left shadow-2xl sm:absolute sm:right-0 sm:top-12"
          data-testid="notification-list"
        >
          <p className="border-b border-border px-4 py-3 text-[13px] font-bold text-foreground">Notifications</p>
          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-[13px] text-muted-foreground">You have no new messages.</p>
          ) : (
            items.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setOpen(false);
                  item.onOpen();
                }}
                className="block w-full border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-muted"
              >
                <span className="block text-[13.5px] font-bold text-foreground">{item.title}</span>
                <span className="mt-0.5 line-clamp-3 block text-[13px] text-muted-foreground">{item.body}</span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
