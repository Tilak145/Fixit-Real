"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, Siren, TrendingUp } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { CORE_CATEGORIES } from "@/components/fixit/service-icons";
import { loadActivity, loadCategories, loadProblems, loadWeek } from "./overview-queries";
import { humanize } from "./ui";

const DAY_MS = 86_400_000;

/** "today", "3 h ago", "Tue" — the way a feed of changes reads. */
export function when(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const minutes = Math.round((Date.now() - then) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 24 * 60) return `${Math.round(minutes / 60)} h ago`;
  const days = Math.round(minutes / (24 * 60));
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function percent(now: number, before: number): { text: string; up: boolean | null } {
  if (before === 0) return { text: now === 0 ? "no change" : "first week", up: now > 0 ? true : null };
  const change = Math.round(((now - before) / before) * 100);
  if (change === 0) return { text: "no change", up: null };
  return { text: `${Math.abs(change)}%`, up: change > 0 };
}

/**
 * Needs attention. Only the things that are actually wrong right now, with the
 * one action that fixes each. An empty list is the good news, said plainly.
 */
export function NeedsAttention({ onGo }: { onGo: (key: string) => void }) {
  const problems = useQuery({ queryKey: ["admin-overview-problems"], queryFn: loadProblems });

  if (problems.isPending) return null;
  if (problems.isError) {
    return (
      <Card className="border-[#F0DCB6] bg-[#FFF7EC]">
        <CardContent className="p-4 text-[13px] text-[#7A4A00]">
          Could not check what needs attention, so nothing is listed here. Reload to try again.
        </CardContent>
      </Card>
    );
  }
  const p = problems.data;
  const rows: Array<{ key: string; label: string; detail: string; to: string; severe: boolean }> = [];
  if (p.stalledEmergencies > 0)
    rows.push({ key: "stalled", label: `${p.stalledEmergencies} emergency${p.stalledEmergencies === 1 ? "" : "s"} with no crew after 2 hours`, detail: "Find the nearest crew and send it.", to: "dispatch", severe: true });
  else if (p.emergencies > 0)
    rows.push({ key: "em", label: `${p.emergencies} emergency${p.emergencies === 1 ? "" : "s"} in progress`, detail: "Every one has a crew on it.", to: "dispatch", severe: false });
  if (p.oldUnclaimed > 0)
    rows.push({ key: "old", label: `${p.oldUnclaimed} request${p.oldUnclaimed === 1 ? "" : "s"} open for over a day`, detail: "No professional has answered it yet.", to: "quote_requests", severe: true });
  if (p.openDisputes > 0)
    rows.push({ key: "disputes", label: `${p.openDisputes} lead dispute${p.openDisputes === 1 ? "" : "s"} to decide`, detail: "A pro says a lead was not worth their time.", to: "lead_integrity", severe: false });
  if (p.flaggedLeads > 0)
    rows.push({ key: "flags", label: `${p.flaggedLeads} request${p.flaggedLeads === 1 ? "" : "s"} held back as suspicious`, detail: "Withheld from professionals until checked.", to: "lead_integrity", severe: false });
  if (p.unverifiedJobs > 0)
    rows.push({ key: "jobs", label: `${p.unverifiedJobs} completed job${p.unverifiedJobs === 1 ? "" : "s"} awaiting value check`, detail: "Confirm the job value before commission.", to: "commissions", severe: false });

  if (rows.length === 0) {
    return (
      <Card className="border-[#CBE7D3] bg-[#F3FBF5]">
        <CardContent className="flex items-center gap-3 p-4 text-[13.5px] text-[#1B7F3B]">
          <TrendingUp className="h-4 w-4" aria-hidden="true" />
          Nothing is stuck right now: no emergency waiting, no request left too long, no dispute open.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="gap-0 p-0">
        <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
          <AlertTriangle className="h-4 w-4 text-[#B26A00]" aria-hidden="true" />
          <h2 className="font-display text-[15px] font-semibold">Needs attention</h2>
          <span className="ml-auto text-[12.5px] text-muted-foreground">{rows.length} thing{rows.length === 1 ? "" : "s"}</span>
        </div>
        <ul className="divide-y divide-border">
          {rows.map((row) => (
            <li key={row.key} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <span className={row.severe ? "h-2 w-2 shrink-0 rounded-full bg-[#D93025]" : "h-2 w-2 shrink-0 rounded-full bg-[#F0A93B]"} aria-hidden="true" />
              <span className="min-w-[220px] flex-1">
                <span className="block text-[13.5px] font-semibold">{row.label}</span>
                <span className="block text-[12.5px] text-muted-foreground">{row.detail}</span>
              </span>
              <button
                type="button"
                onClick={() => onGo(row.to)}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-[12.5px] font-bold text-foreground/80 hover:border-primary hover:text-primary"
              >
                {row.key === "stalled" || row.key === "em" ? <Siren className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                Open <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/** This week against last week: is the marketplace actually growing? */
export function ThisWeek({ onGo }: { onGo: (key: string) => void }) {
  const week = useQuery({ queryKey: ["admin-overview-week"], queryFn: loadWeek });
  if (week.isPending) return null;

  const figures = week.data
    ? [
        { label: "Requests", value: week.data.requests, change: percent(week.data.requests, week.data.previousRequests), to: "quote_requests" },
        { label: "Quotes sent", value: week.data.quotes, change: null, to: "quote_requests" },
        { label: "Jobs won", value: week.data.won, change: null, to: "quote_requests" },
        { label: "New customers", value: week.data.newCustomers, change: null, to: "customer_lookup" },
      ]
    : [];

  return (
    <Card>
      <CardContent className="gap-4 pt-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-[15px] font-semibold">Last 7 days</h2>
          <span className="text-[12.5px] text-muted-foreground">
            {week.isError ? "Could not load" : "Compared with the week before"}
          </span>
        </div>
        {week.isError ? (
          <p className="text-[13px] text-muted-foreground">The numbers could not be read just now.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {figures.map((figure) => (
              <button
                key={figure.label}
                type="button"
                onClick={() => onGo(figure.to)}
                className="rounded-xl border border-border p-4 text-left transition hover:border-primary"
              >
                <span className="block font-display text-2xl font-semibold tabular-nums">{figure.value}</span>
                <span className="block text-[12.5px] text-muted-foreground">{figure.label}</span>
                {figure.change ? (
                  <span className="mt-1 inline-flex items-center gap-1 text-[12px] font-semibold">
                    {figure.change.up === true ? (
                      <ArrowUpRight className="h-3.5 w-3.5 text-[#1B7F3B]" aria-hidden="true" />
                    ) : figure.change.up === false ? (
                      <ArrowDownRight className="h-3.5 w-3.5 text-[#C0392B]" aria-hidden="true" />
                    ) : null}
                    <span className={figure.change.up === false ? "text-[#C0392B]" : figure.change.up === true ? "text-[#1B7F3B]" : "text-muted-foreground"}>
                      {figure.change.text}
                    </span>
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** What changed, from the database's own record, as one readable line. */
function describe(entry: { action: string; table_name: string; detail: Record<string, unknown> | null }): string {
  const detail = entry.detail ?? {};
  const name = detail.business_name ?? detail.name ?? detail.title ?? detail.customer_name ?? detail.category_slug ?? detail.slug;
  const subject = typeof name === "string" && name ? humanize(name) : humanize(entry.table_name);
  const verb = entry.action === "insert" ? "added" : entry.action === "delete" ? "removed" : "changed";
  return `${verb} ${subject}`;
}

export function RecentActivity({ onGo }: { onGo: (key: string) => void }) {
  const activity = useQuery({ queryKey: ["admin-overview-activity"], queryFn: loadActivity });
  if (activity.isPending) return null;

  return (
    <Card>
      <CardContent className="gap-3 pt-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-[15px] font-semibold">Recent activity</h2>
          <button type="button" onClick={() => onGo("activity")} className="text-[12.5px] font-bold text-primary hover:underline">
            Full log
          </button>
        </div>
        {activity.isError ? (
          <p className="text-[13px] text-muted-foreground">The activity log could not be read.</p>
        ) : (activity.data ?? []).length === 0 ? (
          <p className="text-[13px] text-muted-foreground">Nothing has been changed yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {(activity.data ?? []).slice(0, 8).map((entry) => (
              <li key={entry.id} className="flex items-baseline gap-3 py-2.5 text-[13px]">
                <span className="min-w-0 flex-1 truncate">{describe(entry)}</span>
                <span className="shrink-0 text-[12px] text-muted-foreground">{entry.actor_email ?? "the system"}</span>
                <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">{when(entry.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** Which trades have nobody behind them — where the next sign-up should come from. */
export function Coverage({ onGo }: { onGo: (key: string) => void }) {
  const coverage = useQuery({ queryKey: ["admin-overview-coverage"], queryFn: () => loadCategories(CORE_CATEGORIES) });
  if (coverage.isPending || coverage.isError) return null;
  const counts = coverage.data?.counts ?? {};
  const max = Math.max(1, ...Object.values(counts));

  return (
    <Card>
      <CardContent className="gap-3 pt-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-[15px] font-semibold">Coverage by trade</h2>
          <button type="button" onClick={() => onGo("providers")} className="text-[12.5px] font-bold text-primary hover:underline">
            See professionals
          </button>
        </div>
        <ul className="grid gap-2">
          {CORE_CATEGORIES.map((category) => {
            const n = counts[category.slug] ?? 0;
            return (
              <li key={category.slug} className="grid grid-cols-[140px_1fr_28px] items-center gap-3 text-[12.5px]">
                <span className={n === 0 ? "text-muted-foreground" : "font-semibold"}>{category.name}</span>
                <span className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                  <span className={n === 0 ? "block h-full w-0" : "block h-full rounded-full bg-primary"} style={{ width: `${Math.max(8, Math.round((n / max) * 100))}%` }} />
                </span>
                <span className="tabular-nums text-muted-foreground">{n === 0 ? "—" : n}</span>
              </li>
            );
          })}
        </ul>
        {(coverage.data?.idle ?? []).length > 0 ? (
          <p className="rounded-lg bg-[#FFF7EC] px-3 py-2 text-[12.5px] text-[#7A4A00]">
            No approved professional offers {(coverage.data?.idle ?? []).join(", ")} yet. Customers can still ask, and the request waits for the first pro in that trade.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / DAY_MS);
}
