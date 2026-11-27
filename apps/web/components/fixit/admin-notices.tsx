"use client";

import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { requireSupabase } from "@/lib/supabase";

interface Notice {
  id: string;
  tone: "good" | "bad" | "info";
  title: string;
  body: string;
  created_at: string;
}

const TONES: Record<Notice["tone"], string> = {
  good: "border-[#BFE3C8] bg-[#EAF7EE] text-[#1E6B36]",
  bad: "border-[#F0C4C0] bg-[#FDECEA] text-[#8A1F11]",
  info: "border-[#BFD7F2] bg-[#EEF5FD] text-[#0B2545]",
};

/**
 * What FixIt decided about this business (license, insurance, registration,
 * approval). Asked for every few seconds, so a decision shows up while the pro
 * is looking at the page. Each notice stays until the pro closes it.
 */
export function AdminNotices({ providerId }: { providerId: string }) {
  const queryClient = useQueryClient();
  const notices = useQuery({
    queryKey: ["provider-notices", providerId],
    refetchInterval: 3_000,
    retry: false,
    queryFn: async (): Promise<Notice[]> => {
      const { data, error } = await requireSupabase()
        .from("provider_notices")
        .select("id,tone,title,body,created_at")
        .eq("provider_id", providerId)
        .is("read_at", null)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw new Error(error.message);
      return (data ?? []) as Notice[];
    },
  });

  // A new decision changes the badges on the page too, so reload the profile.
  const newest = notices.data?.[0]?.id ?? null;
  const seen = useRef<string | null>(null);
  useEffect(() => {
    if (newest && newest !== seen.current) {
      seen.current = newest;
      void queryClient.invalidateQueries({ queryKey: ["my-provider"] });
    }
  }, [newest, queryClient]);

  const close = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await requireSupabase()
        .from("provider_notices")
        .update({ read_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["provider-notices", providerId] }),
  });

  if (!notices.data?.length) return null;
  return (
    <div className="mb-5 space-y-2" role="status" aria-live="polite" data-testid="admin-notices">
      {notices.data.map((notice) => (
        <div key={notice.id} className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 ${TONES[notice.tone]}`}>
          <span className="min-w-0 flex-1">
            <strong className="block text-[14.5px]">{notice.title}</strong>
            <span className="block text-[13px] opacity-90">{notice.body}</span>
          </span>
          <button
            type="button"
            disabled={close.isPending}
            onClick={() => close.mutate(notice.id)}
            className="rounded-md border border-current px-3 py-1.5 text-[12.5px] font-bold hover:bg-white/50"
          >
            Got it
          </button>
        </div>
      ))}
    </div>
  );
}
