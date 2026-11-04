"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, MapPin, Phone, Send, Timer, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/states";
import { requireSupabase } from "@/lib/supabase";
import { StatusPill, humanize } from "./ui";

interface Emergency {
  id: string;
  category_slug: string | null;
  description: string | null;
  city: string | null;
  customer_name: string | null;
  created_at: string;
  claimed_by: string | null;
}

interface Candidate {
  provider_id: string;
  business_name: string | null;
  phone: string | null;
  service_city: string | null;
  rating: number | null;
  review_count: number | null;
  accepting_work: boolean;
  open_now: boolean;
  miles: number | null;
  minutes: number | null;
  has_quoted: boolean;
}

interface Dispatched {
  provider: string | null;
  provider_id: string | null;
}

async function openEmergencies(): Promise<Emergency[]> {
  const { data, error } = await requireSupabase()
    .from("quote_requests")
    .select("id,category_slug,description,city,customer_name,created_at,claimed_by")
    .eq("is_emergency", true)
    .neq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw new Error(error.message);
  return (data ?? []) as Emergency[];
}

async function nearest(requestId: string): Promise<Candidate[]> {
  const { data, error } = await requireSupabase().rpc("emergency_dispatch", { p_request_id: requestId });
  if (error) throw new Error(error.message);
  return (data ?? []) as Candidate[];
}

async function dispatchedCrews(ids: string[]): Promise<Map<string, Dispatched>> {
  const map = new Map<string, Dispatched>();
  if (ids.length === 0) return map;
  const { data } = await requireSupabase()
    .from("quote_requests")
    .select("id,claimed_by")
    .in("id", ids);
  const providerIds = Array.from(
    new Set(((data ?? []) as Array<{ claimed_by: string | null }>).map((row) => row.claimed_by).filter(Boolean)),
  ) as string[];
  if (providerIds.length === 0) return map;
  const { data: pros } = await requireSupabase().from("providers").select("id,business_name").in("id", providerIds);
  const nameById = new Map(((pros ?? []) as Array<{ id: string; business_name: string }>).map((p) => [p.id, p.business_name]));
  for (const row of (data ?? []) as Array<{ id: string; claimed_by: string | null }>) {
    if (!row.claimed_by) continue;
    map.set(row.id, { provider_id: row.claimed_by, provider: nameById.get(row.claimed_by) ?? "a professional" });
  }
  return map;
}

/** Minutes since the call, said the way a dispatcher says it. */
function waited(createdAt: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(createdAt).getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
}

/**
 * Emergency dispatch. Every open emergency, newest first, with the closest
 * crews that could take it and how far they are. Sending the job to one of
 * them is the same hand-over the pro would do by accepting it, made from here
 * when the customer is waiting on the phone.
 */
export function AdminDispatch() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState<string | null>(null);

  const emergencies = useQuery({ queryKey: ["admin-emergencies"], queryFn: openEmergencies });
  const crews = useQuery({
    queryKey: ["admin-dispatch-crews", open],
    queryFn: () => nearest(open as string),
    enabled: Boolean(open),
  });
  const assigned = useQuery({
    queryKey: ["admin-dispatch-assigned", (emergencies.data ?? []).map((row) => row.id).join(",")],
    queryFn: () => dispatchedCrews((emergencies.data ?? []).map((row) => row.id)),
    enabled: (emergencies.data ?? []).length > 0,
  });

  const send = useMutation({
    mutationFn: async (input: { requestId: string; providerId: string }) => {
      // Hand the job over the same way a pro accepting it would: claimed by
      // that shop, closed to the others, so two crews never both drive out.
      const { error } = await requireSupabase()
        .from("quote_requests")
        .update({ claimed_by: input.providerId, status: "claimed" })
        .eq("id", input.requestId)
        .is("claimed_by", null);
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      toast.success("Job sent to the crew. Their dashboard shows it as theirs.");
      setOpen(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-emergencies"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-dispatch-assigned"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not send that job."),
  });

  const rows = emergencies.data ?? [];
  const unassigned = useMemo(() => rows.filter((row) => !row.claimed_by), [rows]);

  if (emergencies.isPending) return <LoadingState title="Loading emergencies…" />;
  if (emergencies.isError) {
    return <ErrorState title="Could not load emergencies" description={emergencies.error instanceof Error ? emergencies.error.message : "Try again."} />;
  }

  return (
    <div className="grid gap-5">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <h3 className="font-display text-lg font-semibold">Waiting for a crew</h3>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {unassigned.length === 0
                ? "Every emergency has a crew on it."
                : `${unassigned.length} ${unassigned.length === 1 ? "emergency is" : "emergencies are"} waiting. Nearest crew first, by distance from the job.`}
            </p>
          </div>
        </CardContent>
      </Card>

      {rows.length === 0 ? (
        <EmptyState title="No emergencies" description="Emergency requests appear here the moment a customer posts one." />
      ) : (
        <ul className="grid gap-4">
          {rows.map((row) => {
            const crew = row.claimed_by ? assigned.data?.get(row.id) : null;
            return (
              <li key={row.id}>
                <Card className={row.claimed_by ? undefined : "border-l-4 border-l-[#D93025]"}>
                  <CardContent className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-[240px]">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-0.5 text-[12px] font-bold text-destructive">
                            <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" /> Emergency
                          </span>
                          <span className="text-[14px] font-semibold">{humanize(row.category_slug ?? "job")}</span>
                          {row.claimed_by ? <StatusPill value="claimed" /> : <StatusPill value="new" />}
                        </div>
                        <p className="text-[13.5px] text-foreground/85">{row.description || "No description."}</p>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-muted-foreground">
                          <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" aria-hidden="true" />{row.city ?? "No city"}</span>
                          <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" aria-hidden="true" />{waited(row.created_at)}</span>
                          <span>{row.customer_name || "Customer"}</span>
                        </div>
                        {crew ? (
                          <p className="mt-2 text-[13px]">
                            With <strong>{crew.provider}</strong>.
                          </p>
                        ) : null}
                      </div>
                      {!row.claimed_by ? (
                        <Button
                          size="sm"
                          variant={open === row.id ? "default" : "outline"}
                          onClick={() => setOpen(open === row.id ? null : row.id)}
                        >
                          {open === row.id ? "Hide crews" : "Find nearest crew"}
                        </Button>
                      ) : null}
                    </div>

                    {open === row.id ? (
                      <div className="mt-4 border-t border-border pt-4">
                        {crews.isPending ? (
                          <LoadingState title="Checking who is near…" />
                        ) : crews.isError ? (
                          <ErrorState title="Could not check crews" description={crews.error instanceof Error ? crews.error.message : "Try again."} />
                        ) : (crews.data ?? []).length === 0 ? (
                          <p className="text-[13.5px] text-muted-foreground">
                            No approved crew offers this trade in {row.city ?? "this city"} and takes emergencies. The customer still has the request; it will reach a crew as soon as one is available.
                          </p>
                        ) : (
                          <ul className="grid gap-2">
                            {(crews.data ?? []).map((candidate, index) => (
                              <li
                                key={candidate.provider_id}
                                className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border px-4 py-3"
                              >
                                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#E9F1FB] text-[12px] font-bold text-[#1565C0]">
                                  {index + 1}
                                </span>
                                <span className="min-w-[160px] font-semibold">{candidate.business_name?.trim() || "Unnamed business"}</span>
                                <span className="inline-flex items-center gap-1 text-[13px] tabular-nums">
                                  <Timer className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                                  {candidate.miles === null || candidate.minutes === null
                                    ? "Distance unknown"
                                    : `${candidate.minutes} min · ${candidate.miles.toFixed(1)} mi`}
                                </span>
                                <span className={candidate.open_now ? "text-[12.5px] font-semibold text-[#1B7F3B]" : "text-[12.5px] text-muted-foreground"}>
                                  {candidate.open_now ? "Open now" : "Outside posted hours"}
                                </span>
                                {!candidate.accepting_work ? (
                                  <span className="text-[12.5px] text-[#B26A00]">Paused new work</span>
                                ) : null}
                                {candidate.phone ? (
                                  <a href={`tel:${candidate.phone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1 text-[13px] text-primary hover:underline">
                                    <Phone className="h-3.5 w-3.5" aria-hidden="true" /> {candidate.phone}
                                  </a>
                                ) : null}
                                <Button size="sm" className="ml-auto" onClick={() => send.mutate({ requestId: row.id, providerId: candidate.provider_id })} disabled={send.isPending}>
                                  <Send className="h-3.5 w-3.5" aria-hidden="true" /> Send this job
                                </Button>
                              </li>
                            ))}
                          </ul>
                        )}
                        <p className="mt-2 text-[12.5px] text-muted-foreground">
                          Distances are straight-line miles from each shop, with drive time estimated at a town average. Sending claims the job for that crew and closes it to the others.
                        </p>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
