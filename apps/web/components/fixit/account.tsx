"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { CalendarDays, Check, ClipboardList, Copy, Hash, LogOut, MessageSquare, Search, ShieldCheck, Sparkles } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/fixit/site-chrome";
import { LoadingState, ErrorState, EmptyState } from "@/components/app/states";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { RequireAccount } from "@/components/fixit/require-account";
import {
  getMyCustomerNumber,
  getMyProfile,
  listMyAppointments,
  listMyHistory,
  listMyRequests,
  respondToQuote,
  saveMyProfile,
  type HistoryEntry,
  type MyRequest,
} from "@/lib/fixit";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { QuoteComparison } from "@/components/fixit/quote-comparison";
import { MessageThread } from "@/components/fixit/thread";
import { AddressInput } from "@/components/fixit/address-input";

const STATUS: Record<string, { label: string; hint: string; className: string }> = {
  new: {
    // Open for prices. Several matching pros can each send one to compare.
    label: "Collecting quotes",
    hint: "Local pros in your area can send their price. Accept the one you want; the others close.",
    className: "bg-[#FFF4E5] text-[#B26A00]",
  },
  claimed: {
    // Reached only when the customer accepts a price, so it states the outcome.
    label: "You chose a pro",
    hint: "You accepted a price. Your contact details are with that pro, who will arrange the visit.",
    className: "bg-[#E6F4EA] text-[#2E9E4F]",
  },
  completed: {
    label: "Completed",
    hint: "This job is closed. Leave a review from the pro's profile.",
    className: "bg-muted text-muted-foreground",
  },
};

function formatDate(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  return at.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  return at.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function RequestCard({ request }: { request: MyRequest }) {
  const status = STATUS[request.status] ?? STATUS.new;
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2.5">
        <strong className="font-display text-[17px] capitalize">
          {request.category_slug.replace(/-/g, " ")}
        </strong>
        {request.is_emergency ? (
          <span className="rounded-full bg-[#FDECEA] px-3 py-1 text-[11.5px] font-bold text-[#C0392B]">
            Emergency
          </span>
        ) : null}
        <span className={"rounded-full px-3 py-1 text-[11.5px] font-bold " + status.className}>
          {status.label}
        </span>
        <span className="ml-auto text-[12.5px] text-muted-foreground">{formatDate(request.created_at)}</span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{request.description}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-muted-foreground">
        <span>{request.city}</span>
        {request.provider_name ? <span>Pro: {request.provider_name}</span> : null}
      </div>
      <p className="mt-3 border-t border-border pt-3 text-[12.5px] text-muted-foreground">{status.hint}</p>
      {(request.quotes ?? []).length > 0 ? (
        <QuoteComparison quotes={request.quotes ?? []} />
      ) : (
        <p className="mt-3 rounded-lg bg-muted px-3.5 py-2.5 text-[12.5px] text-muted-foreground">
          {request.claimed_by
            ? "A pro is preparing a price. It will appear here for you to accept."
            : "No prices yet. Local pros in your area are being matched to this request."}
        </p>
      )}
      {request.claimed_by && (
        <div className="mt-3">
          <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
            <MessageSquare className="h-4 w-4" aria-hidden="true" />
            {open ? "Hide messages" : "Message the pro"}
          </Button>
        </div>
      )}
      {open && request.claimed_by && (
        <div className="mt-4">
          <MessageThread
            requestId={request.id}
            role="customer"
            counterpart={request.provider_name ?? "the professional"}
          />
        </div>
      )}
    </div>
  );
}

function Requests() {
  const requests = useQuery({ queryKey: ["my-requests"], queryFn: listMyRequests });

  if (requests.isPending) return <LoadingState title="Loading your requests…" />;
  if (requests.isError) {
    return (
      <ErrorState
        title="We could not load your requests"
        description="Check your connection and try again."
        actionLabel="Try again"
        onAction={() => void requests.refetch()}
      />
    );
  }
  if ((requests.data ?? []).length === 0) {
    return (
      <EmptyState
        title="No requests yet"
        description="Ask for a quote and it will appear here while local professionals respond."
      />
    );
  }
  const all = requests.data ?? [];
  return (
    <div className="space-y-4">
      {all.map((request) => (
        <RequestCard key={request.id} request={request} />
      ))}
    </div>
  );
}

function Appointments() {
  const appointments = useQuery({ queryKey: ["my-appointments"], queryFn: listMyAppointments });
  const upcoming = (appointments.data ?? []).filter((a) => a.status === "scheduled");
  const past = (appointments.data ?? []).filter((a) => a.status !== "scheduled");

  if (appointments.isPending) {
    return <p className="text-sm text-muted-foreground">Loading your visits…</p>;
  }
  if (appointments.isError) {
    return <p className="text-sm text-destructive">We could not load your visits. Refresh to try again.</p>;
  }
  if (upcoming.length === 0 && past.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
        No visits scheduled yet. When a professional books a time to come out, it appears here.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {[...upcoming, ...past].map((a) => (
        <div key={a.id} className="flex flex-wrap items-center gap-3.5 rounded-xl border border-border bg-card p-5 shadow-sm">
          <span className="flex h-[46px] w-[46px] flex-none items-center justify-center rounded-[10px] bg-[#E9F1FB]">
            <CalendarDays className="h-5 w-5 text-primary" aria-hidden="true" />
          </span>
          <span className="min-w-[180px] flex-1">
            <strong className="block font-display text-[15px]">{a.title}</strong>
            <span className="block text-[12.5px] text-muted-foreground">
              {formatDateTime(a.scheduled_for)} · {a.city}
            </span>
            {a.notes ? <span className="block text-[12.5px] text-muted-foreground">{a.notes}</span> : null}
          </span>
          <span
            className={
              "rounded-full px-3 py-1.5 text-[11.5px] font-bold " +
              (a.status === "scheduled"
                ? "bg-[#E9F1FB] text-primary"
                : a.status === "completed"
                  ? "bg-[#E6F4EA] text-[#2E9E4F]"
                  : "bg-muted text-muted-foreground")
            }
          >
            {a.status === "scheduled" ? "Scheduled" : a.status === "completed" ? "Completed" : "Cancelled"}
          </span>
        </div>
      ))}
    </div>
  );
}

const HISTORY_ICON: Record<HistoryEntry["kind"], typeof ClipboardList> = {
  request: ClipboardList,
  visit: CalendarDays,
  review: Sparkles,
};

const HISTORY_LABEL: Record<HistoryEntry["kind"], string> = {
  request: "Job requested",
  visit: "Visit",
  review: "Review",
};

/**
 * Everything the customer has done with professionals, in one place. Requests,
 * visits and reviews are separate tables in the database; here they read as one
 * record of the relationship, newest first.
 */
function History() {
  const history = useQuery({ queryKey: ["my-history"], queryFn: listMyHistory });

  if (history.isPending) return <LoadingState title="Loading your history…" />;
  if (history.isError) {
    return (
      <ErrorState
        title="We could not load your history"
        description="Check your connection and try again."
        actionLabel="Try again"
        onAction={() => void history.refetch()}
      />
    );
  }
  const entries = history.data ?? [];
  if (entries.length === 0) {
    return (
      <EmptyState
        title="Nothing here yet"
        description="Every job you request, visit booked and review you leave will be recorded here."
      />
    );
  }
  return (
    <ol className="space-y-3">
      {entries.map((entry) => {
        const Icon = HISTORY_ICON[entry.kind];
        return (
          <li
            key={entry.id}
            className="flex flex-wrap items-start gap-3.5 rounded-xl border border-border bg-card p-4 shadow-sm"
          >
            <span className="flex h-[40px] w-[40px] flex-none items-center justify-center rounded-[10px] bg-[#E9F1FB]">
              <Icon className="h-4.5 w-4.5 text-primary" aria-hidden="true" />
            </span>
            <span className="min-w-[180px] flex-1">
              <span className="mb-0.5 block text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                {HISTORY_LABEL[entry.kind]}
                {entry.status ? ` · ${entry.status}` : ""}
              </span>
              <strong className="block font-display text-[15px] capitalize">{entry.title}</strong>
              <span className="block text-[12.5px] text-muted-foreground">{entry.detail}</span>
            </span>
            <span className="text-[12px] text-muted-foreground">{formatDate(entry.at)}</span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * The details a customer gave at sign-up. The address is the one every quote
 * request is sent from, and it is only shown to the pro who accepts the job.
 */
function CustomerProfileCard() {
  const queryClient = useQueryClient();
  const profile = useQuery({ queryKey: ["my-profile-card"], queryFn: getMyProfile });
  const [draft, setDraft] = useState<{ full_name: string; phone: string; address: string; city: string } | null>(null);
  const editing = draft !== null;

  const save = useMutation({
    mutationFn: saveMyProfile,
    onSuccess: async () => {
      setDraft(null);
      await queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      await queryClient.invalidateQueries({ queryKey: ["my-profile-card"] });
    },
  });

  const rows: Array<{ label: string; value: string | null }> = [
    { label: "Name", value: profile.data?.full_name ?? null },
    { label: "Phone", value: profile.data?.phone ?? null },
    { label: "Service address", value: profile.data?.address ?? null },
    { label: "City", value: profile.data?.city ?? null },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <strong className="block font-display text-[15px]">Your details</strong>
        {editing ? (
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setDraft(null)} disabled={save.isPending}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => draft && save.mutate(draft)} disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setDraft({
                full_name: profile.data?.full_name ?? "",
                phone: profile.data?.phone ?? "",
                address: profile.data?.address ?? "",
                city: profile.data?.city ?? "",
              })
            }
          >
            Edit
          </Button>
        )}
      </div>
      {save.isError ? (
        <p role="alert" className="mb-3 text-sm text-destructive">
          {(save.error as Error).message}
        </p>
      ) : null}
      {editing ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ["full_name", "Name", "name"],
              ["phone", "Phone", "tel"],
              ["address", "Service address", "text"],
              ["city", "City", "text"],
            ] as const
          ).map(([key, label, type]) => (
            <label key={key} className="block">
              <span className="mb-1 block text-xs font-bold text-foreground/70">{label}</span>
              {key === "address" ? (
                <AddressInput
                  value={draft.address}
                  onChange={(value) => setDraft({ ...draft, address: value })}
                  onPick={(suggestion) =>
                    setDraft({ ...draft, address: suggestion.label, city: draft.city || suggestion.cityLabel })
                  }
                  placeholder="Start typing your address"
                  className="h-[42px] w-full rounded-md border border-input bg-input px-3 text-sm outline-none ring-ring focus:ring-2"
                />
              ) : (
                <input
                  type={type}
                  className="h-[42px] w-full rounded-md border border-input bg-input px-3 text-sm outline-none ring-ring focus:ring-2"
                  value={draft[key]}
                  onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
                />
              )}
            </label>
          ))}
        </div>
      ) : (
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {rows.map(({ label, value }) => (
            <div key={label}>
              <dt className="text-[11.5px] font-bold uppercase tracking-wide text-muted-foreground">{label}</dt>
              <dd className="text-[14px]">{value || "—"}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

function CustomerNumberCard() {
  const number = useQuery({ queryKey: ["my-customer-number"], queryFn: getMyCustomerNumber });
  const [copied, setCopied] = useState(false);
  const value = number.data ?? null;

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/[0.06] p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2 text-[12.5px] font-bold uppercase tracking-wide text-primary">
            <Hash className="h-4 w-4" aria-hidden="true" /> Your customer number
          </div>
          <div className="font-display text-4xl font-semibold tracking-[0.12em] tabular-nums">
            {number.isLoading ? "······" : value ?? "—"}
          </div>
          <p className="mt-2 max-w-md text-[13px] text-muted-foreground">
            Give this number when you contact us and we can pull up your requests, prices and visits.
          </p>
        </div>
        <Button
          variant="outline"
          disabled={!value}
          onClick={async () => {
            if (!value) return;
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              // Clipboard can be blocked by the browser; the number stays on screen to read.
            }
          }}
        >
          {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
          {copied ? "Copied" : "Copy number"}
        </Button>
      </div>
    </div>
  );
}


function AccountBody() {
  const { user, signOut } = useAuth();
  const requests = useQuery({ queryKey: ["my-requests"], queryFn: listMyRequests });
  const open = (requests.data ?? []).filter((r) => r.status !== "completed").length;
  const name = (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? "Your account";

  return (
    <section className="mx-auto w-full max-w-[1280px] flex-1 px-6 py-12">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="mb-1 font-display text-3xl font-semibold">Your account</h1>
          <p className="text-sm text-muted-foreground">Signed in as {name}</p>
        </div>
        <Button variant="outline" onClick={() => void signOut()}>
          <LogOut className="h-4 w-4" aria-hidden="true" /> Sign out
        </Button>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {[
          { icon: ClipboardList, label: "Requests sent", value: String((requests.data ?? []).length) },
          { icon: Sparkles, label: "Open now", value: String(open) },
          { icon: ShieldCheck, label: "Account", value: "Verified" },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-5">
            <Icon className="mb-3 h-5 w-5 text-primary" aria-hidden="true" />
            <div className="font-display text-2xl font-semibold tabular-nums">{value}</div>
            <div className="text-[12.5px] text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>

      <div className="mb-8">
        <CustomerNumberCard />
      </div>

      <div className="mb-8">
        <CustomerProfileCard />
      </div>

      <h2 className="mb-4 font-display text-xl font-semibold">Scheduled visits</h2>
      <Appointments />

      <div className="mb-4 mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold">Your quote requests</h2>
        <Link
          href="/request"
          className="inline-flex h-11 items-center gap-2 rounded-md bg-accent px-5 text-sm font-bold text-accent-foreground hover:bg-accent/90"
        >
          <Search className="h-4 w-4" aria-hidden="true" /> Request a new quote
        </Link>
      </div>
      <Requests />

      <h2 className="mb-4 mt-8 font-display text-xl font-semibold">Your history with professionals</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Every job you requested, every visit booked and every review you left, newest first.
      </p>
      <History />

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-5">
        <div>
          <strong className="block font-display text-[15px]">Are you a local professional?</strong>
          <span className="text-[13px] text-muted-foreground">
            Join FixIt and manage your leads from the provider dashboard.
          </span>
        </div>
        <Badge variant="secondary" className="text-[12px]">
          Provider sign-up
        </Badge>
        <Link href="/for-businesses" className="text-sm font-bold text-primary hover:underline">
          List your business →
        </Link>
      </div>
    </section>
  );
}

export function AccountPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <RequireAccount>
        <AccountBody />
      </RequireAccount>
      <SiteFooter />
    </div>
  );
}
