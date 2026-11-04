"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { listMessages, sendMessage } from "@/lib/fixit";

/**
 * The conversation about one quote request. The same component serves the
 * customer and the professional: `role` says who is typing, and the database
 * refuses a message written for the other side.
 */
export function MessageThread({
  requestId,
  role,
  counterpart,
}: {
  requestId: string;
  role: "customer" | "provider";
  counterpart: string;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const messages = useQuery({
    queryKey: ["messages", requestId],
    queryFn: () => listMessages(requestId),
    refetchInterval: 20_000,
  });

  const send = useMutation({
    mutationFn: (body: string) => sendMessage({ requestId, role, body }),
    onSuccess: async () => {
      setDraft("");
      await queryClient.invalidateQueries({ queryKey: ["messages", requestId] });
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.trim() || send.isPending) return;
    send.mutate(draft);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="mb-1 font-display text-[17px] font-semibold">Messages</h3>
      <p className="mb-4 text-[12.5px] text-muted-foreground">
        Send {counterpart} a message about this job.
      </p>

      {messages.isPending ? (
        <p className="text-sm text-muted-foreground">Loading messages…</p>
      ) : messages.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {(messages.error as Error).message}
        </p>
      ) : (messages.data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No messages yet. Agree on a time, a price, or any detail here.
        </p>
      ) : (
        <ul className="mb-4 max-h-[320px] space-y-2.5 overflow-y-auto">
          {(messages.data ?? []).map((message) => {
            const mine = message.sender_role === role;
            return (
              <li
                key={message.id}
                className={`max-w-[85%] rounded-lg px-3.5 py-2.5 text-[13px] leading-relaxed ${
                  mine
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}
              >
                <span className="mb-1 block text-[11px] font-bold opacity-80">
                  {mine ? "You" : counterpart} ·{" "}
                  {new Date(message.created_at).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
                {message.body}
              </li>
            );
          })}
        </ul>
      )}

      <form className="flex gap-2" onSubmit={submit}>
        <input
          aria-label="Write a message"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Write a message…"
          className="h-11 min-w-0 flex-1 rounded-md border border-input bg-input px-3.5 text-sm outline-none ring-ring focus:ring-2"
        />
        <Button type="submit" disabled={send.isPending || !draft.trim()}>
          <Send className="h-4 w-4" aria-hidden="true" />
          {send.isPending ? "Sending…" : "Send"}
        </Button>
      </form>
      {send.isError && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {(send.error as Error).message}
        </p>
      )}
    </div>
  );
}
