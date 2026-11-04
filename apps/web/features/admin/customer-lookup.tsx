"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Hash, Home, Phone, Search, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/states";
import { requireSupabase } from "@/lib/supabase";
import { StatusPill, humanize } from "./ui";

type Visit = { id: string; title: string; scheduled_for: string | null; status: string };
type RequestRow = {
  id: string;
  category_slug: string | null;
  description: string | null;
  city: string | null;
  status: string;
  is_emergency: boolean;
  created_at: string;
  provider: string | null;
  quotes: number;
  accepted_price_cents: number | null;
  visits: Visit[];
  review: { rating: number; comment: string | null } | null;
};
type ReviewRow = { id: string; provider: string | null; rating: number; comment: string | null; created_at: string };
type Activity = {
  customer: {
    user_id: string;
    customer_number: number;
    full_name: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    joined_at: string;
    requests: number;
    quotes_received: number;
    visits: number;
    reviews: number;
  };
  requests: RequestRow[];
  reviews: ReviewRow[];
};

const money = (cents: number | null) =>
  cents === null || cents === undefined
    ? "—"
    : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

const when = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
    : "—";

const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

async function lookupCustomer(number: string): Promise<Activity | null> {
  const { data, error } = await requireSupabase().rpc("customer_activity", { p_number: Number(number) });
  if (error) throw new Error(error.message);
  return (data as Activity | null) ?? null;
}

/**
 * Find customer. A customer gives their six-digit number by phone or email and
 * the whole account opens on one page: who they are, every request, the prices
 * they received and accepted, the visits booked and the feedback left.
 */
export function AdminCustomerLookup() {
  const [draft, setDraft] = useState("");
  const [number, setNumber] = useState<string | null>(null);

  const activity = useQuery({
    queryKey: ["admin-customer-activity", number],
    queryFn: () => lookupCustomer(number as string),
    enabled: number !== null,
  });

  return (
    <div className="grid gap-5">
      <Card>
        <CardContent className="p-5">
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (draft.length === 6) setNumber(draft);
            }}
          >
            <label className="block w-full max-w-[260px]">
              <span className="mb-1 block text-[12.5px] font-bold text-foreground/70">Customer number</span>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  placeholder="123456"
                  className="h-11 pl-9 font-display text-lg tracking-[0.12em] tabular-nums"
                  aria-label="Customer number"
                />
              </div>
            </label>
            <Button type="submit" disabled={draft.length !== 6 || activity.isFetching}>
              <Search className="h-4 w-4" aria-hidden="true" />
              {activity.isFetching ? "Looking up…" : "Look up customer"}
            </Button>
          </form>
          <p className="mt-3 text-[12.5px] text-muted-foreground">
            Six digits, shown on the customer&apos;s account page. This opens their requests, prices, visits and feedback.
          </p>
        </CardContent>
      </Card>

      {number === null ? null : activity.isPending ? (
        <LoadingState title="Looking up that customer…" />
      ) : activity.isError ? (
        <ErrorState title="Could not look up that customer" description={activity.error instanceof Error ? activity.error.message : "Try again."} />
      ) : activity.data === null ? (
        <EmptyState title="No customer with that number" description="Check the six digits with the customer and try again." />
      ) : (
        <CustomerActivity data={activity.data} />
      )}
    </div>
  );
}

function CustomerActivity({ data }: { data: Activity }) {
  const { customer, requests, reviews } = data;
  const stats = [
    { label: "Requests", value: String(customer.requests) },
    { label: "Prices received", value: String(customer.quotes_received) },
    { label: "Visits", value: String(customer.visits) },
    { label: "Reviews", value: String(customer.reviews) },
  ];

  return (
    <>
      <Card>
        <CardContent className="grid gap-5 p-5 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <div className="mb-1 flex items-center gap-2 text-[12.5px] font-bold uppercase tracking-wide text-primary">
              <Hash className="h-4 w-4" aria-hidden="true" /> Customer {String(customer.customer_number).padStart(6, "0")}
            </div>
            <h2 className="font-display text-2xl font-semibold">{customer.full_name || "Unnamed customer"}</h2>
            <dl className="mt-4 grid gap-3 text-[13.5px]">
              <div className="flex items-start gap-2.5">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div>
                  <dt className="text-[12px] font-bold uppercase tracking-wide text-muted-foreground">Phone</dt>
                  <dd>{customer.phone || "Not provided"}</dd>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Home className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div>
                  <dt className="text-[12px] font-bold uppercase tracking-wide text-muted-foreground">Address</dt>
                  <dd>{[customer.address, customer.city].filter(Boolean).join(", ") || "Not provided"}</dd>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div>
                  <dt className="text-[12px] font-bold uppercase tracking-wide text-muted-foreground">Customer since</dt>
                  <dd>{day(customer.joined_at)}</dd>
                </div>
              </div>
            </dl>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {stats.map(({ label, value }) => (
              <div key={label} className="rounded-xl border border-border bg-muted/40 p-4">
                <div className="font-display text-2xl font-semibold tabular-nums">{value}</div>
                <div className="text-[12.5px] text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <h3 className="mb-4 font-display text-lg font-semibold">Everything they have done</h3>
          {requests.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">No requests yet.</p>
          ) : (
            <ol className="relative grid gap-4 border-l border-border pl-5">
              {requests.map((request) => (
                <li key={request.id} className="relative">
                  <span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" aria-hidden="true" />
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <StatusPill value={request.status} />
                    {request.is_emergency ? (
                      <span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-[12px] font-semibold text-destructive">Emergency</span>
                    ) : null}
                    <span className="text-[12.5px] text-muted-foreground">
                      {day(request.created_at)} · {request.city || "No city"}
                    </span>
                  </div>
                  <div className="text-[14px] font-semibold">{humanize(request.category_slug ?? "request")}</div>
                  <p className="mt-0.5 text-[13.5px] text-foreground/80">{request.description || "No description."}</p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-muted-foreground">
                    <span>{request.quotes} {request.quotes === 1 ? "price" : "prices"} received</span>
                    <span>Accepted: {money(request.accepted_price_cents)}</span>
                    <span>Pro: {request.provider || "not chosen"}</span>
                  </div>
                  {request.visits.length > 0 ? (
                    <ul className="mt-2 grid gap-1 text-[13px]">
                      {request.visits.map((visit) => (
                        <li key={visit.id} className="flex flex-wrap items-center gap-2">
                          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                          {visit.title} · {when(visit.scheduled_for)}
                          <StatusPill value={visit.status} />
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {request.review ? (
                    <div className="mt-2 flex items-start gap-2 rounded-lg bg-muted/50 p-2.5 text-[13px]">
                      <Star className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                      <span>
                        {request.review.rating}/5
                        {request.review.comment ? ` — ${request.review.comment}` : ""}
                      </span>
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      {reviews.length > 0 ? (
        <Card>
          <CardContent className="p-5">
            <h3 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
              <Star className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> Feedback left
            </h3>
            <ul className="grid gap-3">
              {reviews.map((review) => (
                <li key={review.id} className="rounded-lg border border-border p-3 text-[13.5px]">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-semibold">{review.rating}/5</span>
                    <span className="text-[12.5px] text-muted-foreground">
                      {review.provider || "Pro"} · {day(review.created_at)}
                    </span>
                  </div>
                  {review.comment ? <p className="text-foreground/80">{review.comment}</p> : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
