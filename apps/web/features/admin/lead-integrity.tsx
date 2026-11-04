"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Flag, ShieldAlert, ShieldCheck, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/states";
import {
  DISPUTE_REASON_LABELS,
  listLeadDisputes,
  listLeadFlags,
  resolveLeadDispute,
  resolveLeadFlag,
} from "@/lib/lead-integrity";
import { StatusPill } from "./ui";

type Tab = "flags" | "disputes";

/**
 * Lead integrity. Two lists, both waiting on a person.
 *
 * The flagged list is the screening rules' output: a request that looked like a
 * duplicate, a test or a bot. A "suspicious" flag keeps the request away from
 * professionals until it is cleared here, so a fake never costs anyone an
 * afternoon. The disputes list is a professional saying a lead was not worth
 * their time; upholding one records that the lead was invalid.
 */
export function AdminLeadIntegrity() {
  const [tab, setTab] = useState<Tab>("flags");

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["flags", "Flagged requests"],
            ["disputes", "Reported leads"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={
              "h-9 rounded-lg border px-3.5 text-[13px] font-bold " +
              (tab === key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground/75 hover:bg-muted")
            }
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "flags" ? <Flags /> : <Disputes />}
    </div>
  );
}

function Flags() {
  const queryClient = useQueryClient();
  const flags = useQuery({ queryKey: ["admin-lead-flags"], queryFn: listLeadFlags });
  const [notes, setNotes] = useState<Record<string, string>>({});

  const resolve = useMutation({
    mutationFn: (input: { flagId: string; status: "cleared" | "confirmed"; note?: string }) =>
      resolveLeadFlag(input),
    onSuccess: async (_data, input) => {
      toast.success(input.status === "cleared" ? "Cleared — the lead is visible again." : "Confirmed — the lead stays withheld.");
      await queryClient.invalidateQueries({ queryKey: ["admin-lead-flags"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save that."),
  });

  if (flags.isPending) return <LoadingState title="Loading flagged requests…" />;
  if (flags.isError) {
    return <ErrorState title="Could not load flagged requests" description={(flags.error as Error).message} />;
  }
  const open = (flags.data ?? []).filter((f) => f.status === "open");
  const done = (flags.data ?? []).filter((f) => f.status !== "open");
  if ((flags.data ?? []).length === 0) {
    return (
      <EmptyState
        title="Nothing flagged"
        description="Requests that look like duplicates, tests or bots appear here for you to clear or confirm."
      />
    );
  }

  return (
    <div className="grid gap-4">
      <p className="rounded-lg border border-border bg-card px-4 py-3 text-[13px] text-muted-foreground">
        A request flagged <strong className="text-foreground">suspicious</strong> is held back from
        professionals until you decide. Clearing it puts it back in front of matching pros;
        confirming it keeps it off the board. A note is only a suggestion, never a block.
      </p>
      {open.length === 0 ? (
        <EmptyState title="No open flags" description="Every flagged request has been reviewed." />
      ) : (
        open.map((flag) => (
          <Card key={flag.id} className={flag.severity === "suspicious" ? "border-l-4 border-l-[#B3261E]" : ""}>
            <CardContent className="gap-3 pt-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-display text-[15px] font-semibold">
                    <Flag className="h-4 w-4 text-[#B3261E]" aria-hidden="true" />
                    {flag.reason}
                  </p>
                  <p className="pt-1 text-[12.5px] text-muted-foreground">
                    {flag.category_slug} · {flag.customer_name} · {flag.city}
                  </p>
                  {flag.description ? (
                    <p className="pt-1 line-clamp-2 max-w-[48rem] text-[13px] text-foreground/80">
                      {flag.description}
                    </p>
                  ) : null}
                </div>
                <StatusPill value={flag.severity} />
              </div>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                <Input
                  placeholder="Note (optional)"
                  value={notes[flag.id] ?? ""}
                  onChange={(event) => setNotes((n) => ({ ...n, [flag.id]: event.target.value }))}
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={resolve.isPending}
                  onClick={() => resolve.mutate({ flagId: flag.id, status: "cleared", note: notes[flag.id] })}
                >
                  <Undo2 className="h-4 w-4" aria-hidden="true" /> Clear
                </Button>
                <Button
                  size="sm"
                  disabled={resolve.isPending}
                  onClick={() => resolve.mutate({ flagId: flag.id, status: "confirmed", note: notes[flag.id] })}
                >
                  <ShieldAlert className="h-4 w-4" aria-hidden="true" /> Confirm fake
                </Button>
              </div>
            </CardContent>
          </Card>
        ))
      )}
      {done.length > 0 ? (
        <details className="rounded-lg border border-border bg-card p-4">
          <summary className="cursor-pointer text-[13px] font-bold text-foreground/80">
            Reviewed ({done.length})
          </summary>
          <ul className="mt-3 space-y-2">
            {done.map((flag) => (
              <li key={flag.id} className="flex items-center justify-between gap-3 border-b border-border pb-2 text-[12.5px] last:border-0">
                <span className="min-w-0 flex-1 truncate">
                  {flag.reason} · {flag.customer_name ?? "unknown"}
                </span>
                <StatusPill value={flag.status} />
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function Disputes() {
  const queryClient = useQueryClient();
  const disputes = useQuery({ queryKey: ["admin-lead-disputes"], queryFn: listLeadDisputes });
  const [notes, setNotes] = useState<Record<string, string>>({});

  const resolve = useMutation({
    mutationFn: (input: { disputeId: string; status: "upheld" | "rejected"; note: string }) =>
      resolveLeadDispute(input),
    onSuccess: async (_data, input) => {
      toast.success(input.status === "upheld" ? "Upheld — the report is on record." : "Rejected.");
      await queryClient.invalidateQueries({ queryKey: ["admin-lead-disputes"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save that."),
  });

  if (disputes.isPending) return <LoadingState title="Loading reported leads…" />;
  if (disputes.isError) {
    return <ErrorState title="Could not load reported leads" description={(disputes.error as Error).message} />;
  }
  const rows = disputes.data ?? [];
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No reported leads"
        description="When a professional reports a lead as fake, duplicate or out of area, it appears here for your decision."
      />
    );
  }
  const open = rows.filter((r) => r.status === "open");
  const done = rows.filter((r) => r.status !== "open");

  const card = (row: (typeof rows)[number]) => (
    <Card key={row.id}>
      <CardContent className="gap-3 pt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 font-display text-[15px] font-semibold">
              <ShieldCheck className="h-4 w-4 text-accent" aria-hidden="true" />
              {DISPUTE_REASON_LABELS[row.reason] ?? row.reason}
            </p>
            <p className="pt-1 text-[12.5px] text-muted-foreground">
              {row.business_name ?? "A professional"} · {row.category_slug} · {row.customer_name} · {row.city}
            </p>
            {row.detail ? (
              <p className="pt-1 max-w-[48rem] text-[13px] text-foreground/80">“{row.detail}”</p>
            ) : null}
          </div>
          <StatusPill value={row.status} />
        </div>
        {row.status === "open" ? (
          <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
            <Input
              placeholder="Decision note (optional)"
              value={notes[row.id] ?? ""}
              onChange={(event) => setNotes((n) => ({ ...n, [row.id]: event.target.value }))}
            />
            <Button
              size="sm"
              disabled={resolve.isPending}
              onClick={() => resolve.mutate({ disputeId: row.id, status: "upheld", note: notes[row.id] ?? "" })}
            >
              <ShieldAlert className="h-4 w-4" aria-hidden="true" /> Uphold
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={resolve.isPending}
              onClick={() => resolve.mutate({ disputeId: row.id, status: "rejected", note: notes[row.id] ?? "" })}
            >
              <Undo2 className="h-4 w-4" aria-hidden="true" /> Reject
            </Button>
          </div>
        ) : row.decision_note ? (
          <p className="rounded-md bg-muted px-3 py-2 text-[12.5px] text-muted-foreground">
            {row.decision_note}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );

  return (
    <div className="grid gap-4">
      {open.length === 0 ? (
        <EmptyState title="No open reports" description="Every reported lead has been decided." />
      ) : (
        open.map(card)
      )}
      {done.length > 0 ? (
        <details className="rounded-lg border border-border bg-card p-4">
          <summary className="cursor-pointer text-[13px] font-bold text-foreground/80">
            Decided ({done.length})
          </summary>
          <div className="mt-3 grid gap-3">{done.map(card)}</div>
        </details>
      ) : null}
    </div>
  );
}

