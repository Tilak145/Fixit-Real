"use client";

import { useQuery } from "@tanstack/react-query";
import { Mail, Users } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/states";
import { requireSupabase } from "@/lib/supabase";
import { humanize } from "./ui";

interface Demand {
  category_slug: string;
  category_name: string;
  waiting: number;
  open_requests: number;
  last_asked_at: string | null;
}

interface Waiter {
  id: string;
  category_slug: string;
  city: string | null;
  email: string;
  note: string | null;
  created_at: string;
}

async function demand(): Promise<Demand[]> {
  const { data, error } = await requireSupabase().rpc("service_demand");
  if (error) throw new Error(error.message);
  return (data ?? []) as Demand[];
}

async function waiters(): Promise<Waiter[]> {
  const { data, error } = await requireSupabase()
    .from("service_waitlist")
    .select("id,category_slug,city,email,note,created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as Waiter[];
}

const day = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—";

/**
 * Demand for the trades nobody serves yet: how many people asked to be told,
 * and how many jobs are waiting with no professional to answer them. That is
 * the list to recruit from — the trade with the most names first.
 */
export function AdminServiceDemand() {
  const trades = useQuery({ queryKey: ["admin-service-demand"], queryFn: demand });
  const people = useQuery({ queryKey: ["admin-service-waiters"], queryFn: waiters });

  if (trades.isPending) return <LoadingState title="Loading demand…" />;
  if (trades.isError) {
    return <ErrorState title="Could not load demand" description={trades.error instanceof Error ? trades.error.message : "Try again."} />;
  }
  const rows = trades.data ?? [];

  return (
    <div className="grid gap-5">
      <Card>
        <CardContent className="p-5">
          <h3 className="font-display text-lg font-semibold">Trades with no professional yet</h3>
          <p className="mb-4 mt-1 text-[13px] text-muted-foreground">
            Ordered by who is asking most. Each name is a customer who wants told when a professional joins.
          </p>
          {rows.length === 0 ? (
            <EmptyState title="Every trade has a professional" description="Nothing is waiting on a new sign-up." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13.5px]">
                <thead>
                  <tr className="border-b border-border text-left text-[12px] uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-3 font-bold">Trade</th>
                    <th className="py-2 pr-3 font-bold">On the list</th>
                    <th className="py-2 pr-3 font-bold">Open jobs waiting</th>
                    <th className="py-2 font-bold">Last asked</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.category_slug} className="border-b border-border last:border-0">
                      <td className="py-3 pr-3 font-semibold">{row.category_name}</td>
                      <td className="py-3 pr-3 tabular-nums">
                        <span className="inline-flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" /> {row.waiting}
                        </span>
                      </td>
                      <td className="py-3 pr-3 tabular-nums">{row.open_requests}</td>
                      <td className="py-3 tabular-nums text-muted-foreground">{day(row.last_asked_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <h3 className="font-display text-lg font-semibold">People waiting</h3>
          <p className="mb-4 mt-1 text-[13px] text-muted-foreground">
            The latest waitlist entries, newest first. Email them when you recruit the first professional in that trade.
          </p>
          {people.isPending ? (
            <LoadingState title="Loading the waitlist…" />
          ) : people.isError ? (
            <ErrorState title="Could not load the waitlist" description={people.error instanceof Error ? people.error.message : "Try again."} />
          ) : (people.data ?? []).length === 0 ? (
            <EmptyState title="Nobody on a waitlist yet" description="Entries appear here when a customer asks to be told about a trade with no professional." />
          ) : (
            <ul className="grid gap-2">
              {(people.data ?? []).map((person) => (
                <li key={person.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border px-4 py-3 text-[13.5px]">
                  <span className="min-w-[120px] font-semibold">{humanize(person.category_slug)}</span>
                  <a href={`mailto:${person.email}`} className="inline-flex items-center gap-1.5 text-primary hover:underline">
                    <Mail className="h-3.5 w-3.5" aria-hidden="true" /> {person.email}
                  </a>
                  {person.note ? <span className="min-w-0 flex-1 truncate text-muted-foreground">{person.note}</span> : <span className="min-w-0 flex-1" />}
                  <span className="tabular-nums text-muted-foreground">{day(person.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
