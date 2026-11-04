"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, Hash, Mail, MapPin, Phone, Search, Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/states";
import { requireSupabase } from "@/lib/supabase";
import { digitsOf, groupNumber } from "@/lib/fixit-numbers";
import { StatusPill, humanize } from "./ui";

interface Pro {
  id: string;
  business_name: string | null;
  pro_number: number | string | null;
  email: string | null;
  phone: string | null;
  status: string;
  plan: string;
  city_list: string | null;
  service_list: string | null;
  joined_at: string;
}

async function lookUp(number: string): Promise<Pro | null> {
  const { data, error } = await requireSupabase().rpc("pro_by_number", { p_number: Number(number) });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Pro[])[0] ?? null;
}

/**
 * Find a business by its nine-digit FixIt number — the number a pro reads out
 * when they call. The customer look-up's counterpart, kept separate because a
 * business and a customer are different records with different numbers.
 */
export function AdminProLookup() {
  const [draft, setDraft] = useState("");
  const clean = digitsOf(draft);

  // Nine digits is the whole answer: look it up as soon as they are there, so
  // nothing has to be pressed.
  useEffect(() => {
    if (clean.length !== 9) return;
    const timer = setTimeout(() => setNumber(clean), 250);
    return () => clearTimeout(timer);
  }, [clean]);

  const [number, setNumber] = useState<string | null>(null);
  const pro = useQuery({
    queryKey: ["admin-pro-lookup", number],
    queryFn: () => lookUp(number as string),
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
              if (clean.length === 9) setNumber(clean);
            }}
          >
            <label className="block w-full max-w-[300px]">
              <span className="mb-1 block text-[12.5px] font-bold text-foreground/70">FixIt pro number</span>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value.replace(/[^\d\s-]/g, "").slice(0, 11))}
                  inputMode="numeric"
                  placeholder="304 215 887"
                  className="h-11 pl-9 font-display text-lg tracking-[0.08em] tabular-nums"
                  aria-label="FixIt pro number"
                />
              </div>
            </label>
            <Button type="submit" disabled={clean.length !== 9 || pro.isFetching}>
              <Search className="h-4 w-4" aria-hidden="true" />
              {pro.isFetching ? "Looking up…" : "Find business"}
            </Button>
          </form>
          <p className="mt-3 text-[12.5px] text-muted-foreground">
            Nine digits, shown on the business&apos;s own dashboard under Business profile. This is FixIt&apos;s number for the
            business, not its Ohio licence number.
          </p>
        </CardContent>
      </Card>

      {number === null ? null : pro.isPending ? (
        <LoadingState title="Looking up that business…" />
      ) : pro.isError ? (
        <ErrorState title="Could not look up that business" description={pro.error instanceof Error ? pro.error.message : "Try again."} />
      ) : pro.data === null ? (
        <EmptyState title="No business with that number" description="Check the nine digits, and that the spaces are not another number's." />
      ) : (
        <Card>
          <CardContent className="grid gap-5 p-5 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <div className="mb-1 flex items-center gap-2 text-[12.5px] font-bold uppercase tracking-wide text-primary">
                <Building2 className="h-4 w-4" aria-hidden="true" />
                FixIt pro {pro.data.pro_number ? groupNumber(String(pro.data.pro_number)) : "—"}
              </div>
              <h2 className="font-display text-2xl font-semibold">{pro.data.business_name?.trim() || "Unnamed business"}</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                <StatusPill value={pro.data.status} />
                <StatusPill value={pro.data.plan} />
              </div>
              <dl className="mt-4 grid gap-3 text-[13.5px]">
                <div className="flex items-start gap-2.5">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div>
                    <dt className="text-[12px] font-bold uppercase tracking-wide text-muted-foreground">Email</dt>
                    <dd>{pro.data.email || "Not provided"}</dd>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <Phone className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div>
                    <dt className="text-[12px] font-bold uppercase tracking-wide text-muted-foreground">Phone</dt>
                    <dd>{pro.data.phone || "Not provided"}</dd>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div>
                    <dt className="text-[12px] font-bold uppercase tracking-wide text-muted-foreground">Service area</dt>
                    <dd>{pro.data.city_list || "No cities set"}</dd>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <Wrench className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div>
                    <dt className="text-[12px] font-bold uppercase tracking-wide text-muted-foreground">Trades</dt>
                    <dd>{pro.data.service_list ? pro.data.service_list.split(", ").map(humanize).join(", ") : "No trades set"}</dd>
                  </div>
                </div>
              </dl>
            </div>
            <div className="rounded-xl border border-border bg-muted/40 p-4">
              <p className="text-[12px] font-bold uppercase tracking-wide text-muted-foreground">Joined</p>
              <p className="text-[14px]">
                {new Date(pro.data.joined_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </p>
              <p className="mt-4 text-[13px] text-muted-foreground">
                To change this business, open Professionals and search its pro number. The number itself never changes.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
