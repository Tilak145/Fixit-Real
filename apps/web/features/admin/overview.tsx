"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarCheck,
  Check,
  ClipboardList,
  ExternalLink,
  MessageSquare,
  ShieldCheck,
  Star,
  UsersRound,
  Wrench,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorState, LoadingState } from "@/components/app/states";
import { requireSupabase } from "@/lib/supabase";
import { documentSignedUrl } from "@/lib/fixit";
import { StatusPill } from "./ui";
import { Coverage, NeedsAttention, RecentActivity, ThisWeek } from "./overview-extra";
import { cn } from "@/lib/utils";

/** One number with a label: the smallest useful summary tile. */
function Stat({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  icon: typeof Wrench;
  tone?: "default" | "warn" | "good";
}) {
  return (
    <Card
      className={cn(
        "h-full transition group-hover:-translate-y-0.5 group-hover:shadow-md",
        tone === "warn" && "border-l-4 border-l-[#F57C00]",
        tone === "good" && "border-l-4 border-l-[#2E9E4F]",
        tone === "default" && "border-l-4 border-l-transparent",
      )}
    >
      <CardContent className="gap-1.5 pt-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[12px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
          <span
            className={cn(
              "grid h-8 w-8 shrink-0 place-items-center rounded-lg",
              tone === "warn" ? "bg-[#FFF3E0] text-[#B35C00]"
                : tone === "good" ? "bg-[#E7F6EC] text-[#1B7F3B]"
                  : "bg-[#E9F1FB] text-[#1565C0]",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        </div>
        <p className="font-display text-3xl font-semibold tabular-nums">{value}</p>
        {hint ? <p className="text-[12.5px] text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

/** How many rows a table has, optionally only those matching a column value. */
async function count(table: string, column?: string, value?: string): Promise<number> {
  const builder = requireSupabase().from(table).select("id", { count: "exact", head: true });
  const query = column && value !== undefined ? builder.match({ [column]: value }) : builder;
  const { count: total, error } = await query;
  if (error) throw new Error(error.message);
  return total ?? 0;
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/**
 * The landing view: what is waiting for attention and how the marketplace is
 * doing, before anyone opens a table and reads rows.
 */
export function AdminOverview({ onOpen, onGo }: { onOpen: (table: string) => void; onGo?: (key: string) => void }) {
  const stats = useQuery({
    queryKey: ["admin-overview"],
    queryFn: async () => {
      const [pendingPros, approvedPros, openRequests, claimedRequests, upcoming, reviews, messages] =
        await Promise.all([
          count("providers", "status", "pending"),
          count("providers", "status", "approved"),
          count("quote_requests", "status", "new"),
          count("quote_requests", "status", "claimed"),
          count("appointments", "status", "scheduled"),
          count("reviews"),
          count("messages"),
        ]);
      return { pendingPros, approvedPros, openRequests, claimedRequests, upcoming, reviews, messages };
    },
  });

  const recent = useQuery({
    queryKey: ["admin-recent-requests"],
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from("quote_requests")
        .select("id,category_slug,customer_name,city,status,is_emergency,created_at")
        .order("is_emergency", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(6);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const waitingPros = useQuery({
    queryKey: ["admin-waiting-pros"],
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from("providers")
        .select("id,auth_user_id,business_name,address,plan,status,license_number,license_status,license_note,license_verified_at,insurance_status,insurance_verified_at,business_registration_number,business_registration_status,business_registration_checked_at,created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(5);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  // The documents each waiting applicant uploaded. Grouped by the applicant's
  // account so the review card can link straight to the photo ID and insurance
  // certificate rather than asking the owner to hunt for them.
  const waitingDocs = useQuery({
    queryKey: ["admin-waiting-docs", (waitingPros.data ?? []).map((p) => String(p.auth_user_id ?? "")).join(",")],
    enabled: (waitingPros.data ?? []).length > 0,
    queryFn: async () => {
      const ids = (waitingPros.data ?? []).map((p) => String(p.auth_user_id ?? "")).filter(Boolean);
      if (ids.length === 0) return {} as Record<string, Array<{ kind: string; file_name: string; storage_path: string }>>;
      const { data, error } = await requireSupabase()
        .from("provider_documents")
        .select("auth_user_id,kind,file_name,storage_path")
        .in("auth_user_id", ids);
      if (error) throw new Error(error.message);
      const grouped: Record<string, Array<{ kind: string; file_name: string; storage_path: string }>> = {};
      for (const row of data ?? []) {
        const key = String(row.auth_user_id);
        (grouped[key] ??= []).push({
          kind: String(row.kind),
          file_name: String(row.file_name),
          storage_path: String(row.storage_path),
        });
      }
      return grouped;
    },
  });

  // The founding cohort: who is on a free place and when each free period ends,
  // so the owner can see the 100 filling up and who is about to convert.
  const foundingCohort = useQuery({
    queryKey: ["admin-founding-cohort"],
    queryFn: async () => {
      const { data, error } = await requireSupabase().rpc("founding_cohort");
      if (error) throw new Error(error.message);
      return (data ?? []) as Array<{ provider_id: string; business_name: string; joined_at: string; trial_ends_at: string | null }>;
    },
  });

  async function openDocument(path: string) {
    const url = await documentSignedUrl(path);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
    else toast.error("Could not open that document.");
  }

  // Approving is the one decision this screen exists to make, so it happens
  // here rather than three clicks away in the Professionals table. The update
  // is a plain status change; the site lists a professional only when its
  // status is "approved", so this is what puts someone live.
  const queryClient = useQueryClient();
  // Runs the licence check and stores its verdict on the provider, then reloads
  // the list so the row shows the result straight away.
  const check = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await requireSupabase().rpc("check_provider_license", {
        provider_id: id,
      });
      if (error) throw new Error(error.message);
      const row = Array.isArray(data) ? data[0] : data;
      return (row as { status?: string; note?: string } | null) ?? null;
    },
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-waiting-pros"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-overview"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-rows", "providers"] }),
      ]);
      if (result?.status === "format_ok") toast.success(result.note ?? "Licence looks valid");
      else toast.error(result?.note ?? "That licence number did not pass the check");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Recording what was actually verified. The licence check only judges the
  // number's shape; confirming it against the state register is a person's job,
  // and this is where they record that they did it.
  const verifyEvidence = useMutation({
    mutationFn: async (input: { id: string; evidence: "license" | "insurance"; verdict: string; note?: string }) => {
      const { error } = await requireSupabase().rpc("verify_provider_evidence", {
        provider_id: input.id,
        evidence: input.evidence,
        verdict: input.verdict,
        note: input.note ?? null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: async (_data, input) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-waiting-pros"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-overview"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-rows", "providers"] }),
      ]);
      if (input.evidence === "license") toast.success("Licence marked confirmed.");
      else toast.success(input.verdict === "verified" ? "Insurance marked verified." : "Insurance marked not accepted.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Recording the Secretary of State check. The register cannot be queried from
  // here, so the owner opens it, finds the number, and records what they found —
  // the same one-person-confirms rule as the licence.
  const checkRegistration = useMutation({
    mutationFn: async (input: { id: string; verdict: "confirmed" | "not_found" | "unverified" }) => {
      const { error } = await requireSupabase().rpc("verify_business_registration", {
        provider_id: input.id,
        verdict: input.verdict,
        note: null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: async (_data, input) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-waiting-pros"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-overview"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-rows", "providers"] }),
      ]);
      toast.success(
        input.verdict === "confirmed"
          ? "Business registration confirmed."
          : input.verdict === "not_found"
            ? "Marked as not found on the register."
            : "Business registration reset.",
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const decide = useMutation({
    mutationFn: async (input: { id: string; status: "approved" | "rejected" }) => {
      const { error } = await requireSupabase()
        .from("providers")
        .update({ status: input.status })
        .eq("id", input.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: async (_data, input) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-overview"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-waiting-pros"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-rows", "providers"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-activity"] }),
      ]);
      toast.success(input.status === "approved" ? "Approved and listed" : "Declined");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Where a tile leads. Some open a managed table; the rest open its section.
  const tiles = useMemo(() => {
    if (!stats.data) return [];
    const s = stats.data;
    return [
      { key: "pending", label: "Awaiting approval", value: String(s.pendingPros), hint: s.pendingPros ? "Providers waiting on you" : "Nothing waiting", tone: s.pendingPros ? ("warn" as const) : ("default" as const), table: "providers", icon: ShieldCheck },
      { key: "open", label: "Open requests", value: String(s.openRequests), hint: "New, unmatched jobs", tone: "default" as const, table: "quote_requests", icon: ClipboardList },
      { key: "claimed", label: "In progress", value: String(s.claimedRequests), hint: "A pro is on it", tone: "default" as const, table: "quote_requests", icon: Wrench },
      { key: "visits", label: "Visits booked", value: String(s.upcoming), hint: "Scheduled appointments", tone: "default" as const, table: "appointments", icon: CalendarCheck },
      { key: "pros", label: "Approved pros", value: String(s.approvedPros), hint: "Listed on the site", tone: "good" as const, table: "providers", icon: UsersRound },
      { key: "reviews", label: "Reviews", value: String(s.reviews), hint: "Across all pros", tone: "default" as const, table: "reviews", icon: Star },
      { key: "messages", label: "Messages", value: String(s.messages), hint: "Customer and pro chat", tone: "default" as const, table: "messages", icon: MessageSquare },
    ];
  }, [stats.data]);

  if (stats.isPending) {
    return <LoadingState title="Loading the overview…" />;
  }
  if (stats.isError) {
    return (
      <ErrorState
        title="Could not load the overview"
        description={(stats.error as Error).message}
        actionLabel="Try again"
        onAction={() => void stats.refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-[12px] font-bold uppercase tracking-wide text-muted-foreground">
          {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </p>
        <h2 className="pt-1 font-display text-xl font-semibold">
          {greeting()}, here is where FixIt stands
        </h2>
        <p className="pt-1 text-sm text-muted-foreground">
          {stats.data.pendingPros > 0
            ? `${stats.data.pendingPros} professional${stats.data.pendingPros === 1 ? "" : "s"} waiting on your approval.`
            : "Nothing is waiting on you right now."}
        </p>
      </div>

      <NeedsAttention onGo={(key) => (onGo ? onGo(key) : onOpen(key))} />

      <ThisWeek onGo={(key) => (onGo ? onGo(key) : onOpen(key))} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((tile) => (
          <button
            key={tile.key}
            type="button"
            onClick={() => onOpen(tile.table)}
            className="group text-left"
            aria-label={`Open ${tile.label}`}
          >
            <Stat
              label={tile.label}
              value={tile.value}
              hint={tile.hint}
              tone={tile.tone}
              icon={tile.icon}
            />
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="gap-4 pt-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-lg font-semibold">Waiting for approval</h2>
              <button
                type="button"
                onClick={() => onOpen("providers")}
                className="text-[12.5px] font-bold text-primary hover:underline"
              >
                View all
              </button>
            </div>
            {waitingPros.isPending ? (
              <p className="text-sm text-muted-foreground">Checking…</p>
            ) : (waitingPros.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing is waiting. New provider applications appear here.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {(waitingPros.data ?? []).map((pro) => {
                  const id = String(pro.id ?? "");
                  const licenseNumber = String(pro.license_number ?? "");
                  const licenseStatus = String(pro.license_status ?? "unverified");
                  const checking = check.isPending && check.variables === id;
                  const deciding = decide.isPending && decide.variables?.id === id;
                  const busy = checking || deciding;
                  // Approving is allowed once the number's shape is sound, but
                  // the customer-facing "verified" badge needs both checks
                  // confirmed, which the buttons above record.
                  const passed = licenseStatus === "format_ok" || licenseStatus === "lookup_verified";
                  return (
                    <li key={id} className="space-y-2.5 py-3.5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() => onOpen("providers")}
                            className="block max-w-full truncate text-left font-semibold hover:text-primary hover:underline"
                          >
                            {String(pro.business_name)}
                          </button>
                          <p className="truncate text-[12.5px] text-muted-foreground">
                            {String(pro.address ?? "No address")} · {String(pro.plan ?? "—")} plan
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={() => check.mutate(id)}
                          >
                            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                            {checking ? "Checking…" : licenseStatus === "unverified" ? "Check licence" : "Recheck"}
                          </Button>
                          <Button size="sm" disabled={busy || !passed} onClick={() => decide.mutate({ id, status: "approved" })}>
                            <Check className="h-4 w-4" aria-hidden="true" />
                            {deciding ? "Saving…" : "Approve"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={() => {
                              if (!window.confirm(`Decline ${String(pro.business_name)}? They will not be listed.`)) return;
                              decide.mutate({ id, status: "rejected" });
                            }}
                          >
                            <X className="h-4 w-4" aria-hidden="true" />
                            Decline
                          </Button>
                        </div>
                      </div>
                      {/* What has actually been verified, and the two
                          confirmations only a person can give. Approving is
                          not verifying: these are the checks that the
                          customer-facing badge depends on. */}
                      <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
                        <span className="text-muted-foreground">Checks:</span>
                        <span
                          className={
                            "rounded-full px-2 py-0.5 text-[11px] font-bold " +
                            (pro.license_verified_at
                              ? "bg-[#E6F4EA] text-[#2E9E4F]"
                              : "bg-muted text-muted-foreground")
                          }
                        >
                          {pro.license_verified_at ? "Licence confirmed" : "Licence not confirmed"}
                        </span>
                        <span
                          className={
                            "rounded-full px-2 py-0.5 text-[11px] font-bold " +
                            (pro.insurance_status === "verified"
                              ? "bg-[#E6F4EA] text-[#2E9E4F]"
                              : pro.insurance_status === "rejected"
                                ? "bg-[#FDECEA] text-[#D93025]"
                                : "bg-muted text-muted-foreground")
                          }
                        >
                          {pro.insurance_status === "verified"
                            ? "Insurance verified"
                            : pro.insurance_status === "rejected"
                              ? "Insurance rejected"
                              : "Insurance not verified"}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={verifyEvidence.isPending}
                          onClick={() =>
                            verifyEvidence.mutate({
                              id,
                              evidence: "license",
                              verdict: "lookup_verified",
                              note: "Confirmed against the state register.",
                            })
                          }
                        >
                          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                          Confirm licence
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={verifyEvidence.isPending}
                          onClick={() =>
                            verifyEvidence.mutate({ id, evidence: "insurance", verdict: "verified" })
                          }
                        >
                          <Check className="h-4 w-4" aria-hidden="true" />
                          Verify insurance
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={verifyEvidence.isPending}
                          onClick={() =>
                            verifyEvidence.mutate({ id, evidence: "insurance", verdict: "rejected" })
                          }
                        >
                          Insurance not accepted
                        </Button>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
                        <span className="text-muted-foreground">Licence:</span>
                        {licenseNumber ? (
                          <span className="font-semibold tabular-nums">{licenseNumber}</span>
                        ) : (
                          <span className="text-muted-foreground">not given</span>
                        )}
                        <StatusPill value={licenseStatus} />
                        {pro.license_note ? (
                          <span className="text-muted-foreground">{String(pro.license_note)}</span>
                        ) : null}
                      </div>
                      {/* The business's registration with the Ohio Secretary of
                          State. The register cannot be queried from here (it is
                          behind Cloudflare), so this shows the number, links to
                          the search, and records what the owner found. */}
                      <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
                        <span className="text-muted-foreground">Business reg.:</span>
                        {pro.business_registration_number ? (
                          <span className="font-semibold tabular-nums">
                            {String(pro.business_registration_number)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">not given</span>
                        )}
                        {pro.business_registration_status && pro.business_registration_status !== "unverified" ? (
                          <StatusPill value={String(pro.business_registration_status)} />
                        ) : null}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            window.open(
                              "https://businesssearch.ohiosos.gov/",
                              "_blank",
                              "noopener,noreferrer",
                            )
                          }
                        >
                          <ExternalLink className="h-4 w-4" aria-hidden="true" />
                          Look up
                        </Button>
                        {pro.business_registration_number ? (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={checkRegistration.isPending}
                              onClick={() => checkRegistration.mutate({ id, verdict: "confirmed" })}
                            >
                              <Check className="h-4 w-4" aria-hidden="true" />
                              Confirm registered
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={checkRegistration.isPending}
                              onClick={() => checkRegistration.mutate({ id, verdict: "not_found" })}
                            >
                              Not found
                            </Button>
                          </>
                        ) : null}
                      </div>
                      {(() => {
                        const docs = waitingDocs.data?.[String(pro.auth_user_id ?? "")] ?? [];
                        const photoId = docs.find((d) => d.kind === "photo_id");
                        const insurance = docs.find((d) => d.kind === "insurance");
                        return (
                          <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
                            <span className="text-muted-foreground">Documents:</span>
                            {photoId ? (
                              <button
                                type="button"
                                onClick={() => void openDocument(photoId.storage_path)}
                                className="font-bold text-primary hover:underline"
                              >
                                Photo ID
                              </button>
                            ) : (
                              <span className="text-muted-foreground">no photo ID</span>
                            )}
                            <span aria-hidden="true" className="text-muted-foreground">·</span>
                            {insurance ? (
                              <button
                                type="button"
                                onClick={() => void openDocument(insurance.storage_path)}
                                className="font-bold text-primary hover:underline"
                              >
                                Insurance
                              </button>
                            ) : (
                              <span className="text-muted-foreground">no insurance</span>
                            )}
                          </div>
                        );
                      })()}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="gap-4 pt-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-lg font-semibold">Latest requests</h2>
              <button
                type="button"
                onClick={() => onOpen("quote_requests")}
                className="text-[12.5px] font-bold text-primary hover:underline"
              >
                View all
              </button>
            </div>
            {recent.isPending ? (
              <p className="text-sm text-muted-foreground">Checking…</p>
            ) : (recent.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No requests yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {(recent.data ?? []).map((row) => (
                  <li key={String(row.id)} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold capitalize">
                        {String(row.category_slug ?? "").replace(/-/g, " ")}
                      </p>
                      <p className="truncate text-[12.5px] text-muted-foreground">
                        {String(row.customer_name ?? "—")} · {String(row.city ?? "—")}
                      </p>
                    </div>
                    {row.is_emergency ? (
                      <span className="rounded-full bg-[#FDECEA] px-2.5 py-1 text-[11px] font-bold text-[#C0392B]">
                        Emergency
                      </span>
                    ) : null}
                    <StatusPill value={String(row.status ?? "unknown")} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="gap-4 pt-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold">Founding cohort</h2>
            <span className="text-[12.5px] text-muted-foreground">
              {foundingCohort.data ? foundingCohort.data.length : 0} of 100 places taken
            </span>
          </div>
          <p className="text-[12.5px] text-muted-foreground">
            Each founding pro is free for three months, then pays the plan they chose. Nothing is charged
            automatically — this is where you see whose free period is about to end.
          </p>
          {foundingCohort.isPending ? (
            <p className="text-sm text-muted-foreground">Checking…</p>
          ) : (foundingCohort.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No founding pros yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {(foundingCohort.data ?? []).map((row) => {
                const ends = row.trial_ends_at ? new Date(row.trial_ends_at) : null;
                const daysLeft = ends ? Math.ceil((ends.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
                return (
                  <li key={row.provider_id} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{row.business_name}</p>
                      <p className="text-[12.5px] text-muted-foreground">
                        Joined {new Date(row.joined_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                    {ends ? (
                      <span
                        className={
                          "rounded-full px-2.5 py-1 text-[11px] font-bold " +
                          (daysLeft !== null && daysLeft <= 0
                            ? "bg-[#FDECEA] text-[#B3261E]"
                            : daysLeft !== null && daysLeft <= 14
                              ? "bg-[#FFF3E0] text-[#B35C00]"
                              : "bg-[#E7F6EC] text-[#1B7F3B]")
                        }
                      >
                        {daysLeft !== null && daysLeft <= 0
                          ? "Free period ended"
                          : "Free until " + ends.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    ) : (
                      <StatusPill value="unverified" />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <RecentActivity onGo={(key) => (onGo ? onGo(key) : onOpen(key))} />
        <Coverage onGo={(key) => (onGo ? onGo(key) : onOpen(key))} />
      </div>
    </div>
  );
}
