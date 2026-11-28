"use client";

// The overview, laid out like the agreed design. Every box is counted from this
// account's own records; an empty box says so instead of showing an example.
import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowDown, ArrowRight, ArrowUp, Building2, ChevronRight, HardHat, Home, MapPin, Plus, Wrench } from "lucide-react";
import { respondToQuote, type JobQuote } from "@/lib/fixit";
import type { Organization } from "@/lib/manage-model";
import {
  axisTop,
  changeFromLastMonth,
  completedThisMonth,
  greeting,
  monthlySpending,
  openParts,
  splitVisits,
  type MonthTotal,
  type StatusPart,
} from "@/lib/overview-model";
import { money, type Repair } from "@/lib/repair-model";
import { quoteLines, validity } from "@/lib/quote-comparison";
import { listProperties, listUnits, photoLinks } from "@/components/manage/data";
import { listRepairs } from "@/components/manage/repair-data";
import { getJobActivity, type OverviewVisit } from "@/components/manage/overview-data";
import { StatusPill } from "@/components/manage/repairs";
import { ErrorState, Loading } from "@/components/manage/ui";

function Panel({ title, href, children }: { title: string; href?: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-2xl border border-[#E4E9F1] bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-display text-[19px] font-bold">{title}</h2>
        {href ? (
          <Link href={href} className="flex flex-none items-center gap-1 text-[14px] font-bold text-[#B4470A] hover:underline">
            View all <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

const Quiet = ({ children }: { children: React.ReactNode }) => <p className="py-3 text-[13.5px] text-[#475569]">{children}</p>;

const repairHref = (id: string) => `/manage?view=repairs&repair=${id}`;

function ago(value: string, now: Date): string {
  const minutes = Math.round((now.getTime() - new Date(value).getTime()) / 60_000);
  if (minutes < 2) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 24 * 60) return `${Math.round(minutes / 60)} h ago`;
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function Overview({ organization }: { organization: Organization }) {
  const records = useQuery({
    queryKey: ["manage", "overview", organization.id],
    refetchInterval: 20_000,
    queryFn: async () => {
      const [properties, units, repairs] = await Promise.all([
        listProperties(organization.id),
        listUnits(organization.id),
        listRepairs(organization.id),
      ]);
      const jobs = repairs.filter((repair) => repair.quote_request_id).map((repair) => repair.quote_request_id!);
      const activity = await getJobActivity(jobs);
      const active = properties.filter((property) => !property.archived_at);
      const photos = await photoLinks(active.slice(0, 3).map((p) => p.photo_path).filter((p): p is string => Boolean(p)));
      return { properties, units, repairs, active, photos, ...activity };
    },
  });
  if (records.isPending) return <Loading label="Counting your records…" />;
  if (records.isError) return <ErrorState message={(records.error as Error).message} onRetry={() => records.refetch()} />;

  const { properties, units, repairs, active, photos, quotes, visits } = records.data;
  const now = new Date();
  const activeIds = new Set(active.map((property) => property.id));
  const parts = openParts(repairs);
  const open = parts.reduce((sum, part) => sum + part.count, 0);
  const byJob = new Map(repairs.filter((r) => r.quote_request_id).map((r) => [r.quote_request_id!, r]));
  const where = (repair: Repair) => {
    const property = properties.find((p) => p.id === repair.property_id)?.name ?? "Property";
    const unit = units.find((u) => u.id === repair.unit_id)?.label;
    return unit ? `${property} • ${unit}` : property;
  };

  // Prices still to be answered, urgent repairs first.
  const waiting = quotes
    .filter((quote) => quote.status === "sent" && byJob.get(quote.quote_request_id)?.status === "awaiting_approval")
    .map((quote) => ({ quote, repair: byJob.get(quote.quote_request_id)! }))
    .sort((a, b) => Number(b.repair.priority === "urgent") - Number(a.repair.priority === "urgent"));

  const months = monthlySpending(
    quotes
      .filter((quote) => quote.status === "accepted")
      .map((quote) => ({
        at: quote.responded_at ?? quote.created_at,
        cents: byJob.get(quote.quote_request_id)?.final_cost_cents ?? quote.amount_cents,
      })),
    now,
  );
  const change = changeFromLastMonth(months);
  // A finished or cancelled repair has no visit left to wait for.
  const schedule = splitVisits(
    visits.filter((visit) => !["completed", "cancelled"].includes(byJob.get(visit.quote_request_id)?.status ?? "cancelled")),
    now,
  );

  const cards = [
    { label: "Properties", value: active.length, icon: Building2, tone: "bg-[#E3EEFD] text-[#1457C0]", href: "/manage?view=properties" },
    { label: "Rental units", value: units.filter((u) => !u.archived_at && activeIds.has(u.property_id)).length, icon: Home, tone: "bg-[#FFF0E3] text-[#B4470A]", href: "/manage?view=properties" },
    { label: "Open requests", value: open, icon: Wrench, tone: "bg-[#FFF0E3] text-[#B4470A]", href: "/manage?view=repairs" },
    { label: "Urgent repairs", value: parts[0].count, icon: AlertTriangle, tone: "bg-[#FDE7E7] text-[#B42318]", href: "/manage?view=repairs" },
  ];

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-[32px] font-bold leading-tight">{greeting(now)}</h1>
          <p className="text-[15px] text-[#475569]">Your properties, maintenance requests and service providers all in one place.</p>
        </div>
        <Link href="/manage?view=repairs&new=1" className="inline-flex items-center gap-3 rounded-lg bg-[#D9560B] px-6 py-3.5 text-[15px] font-bold text-white shadow-sm hover:bg-[#C14B08]">
          <Plus className="h-5 w-5" aria-hidden="true" /> New service request
        </Link>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, tone, href }) => (
          <Link key={label} href={href} className="flex min-w-0 items-center gap-3 rounded-2xl border border-[#E4E9F1] bg-white p-4 shadow-sm hover:border-[#F26B1D]">
            <span className={`grid h-12 w-12 flex-none place-items-center rounded-full ${tone}`}>
              <Icon className="h-6 w-6" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-[13.5px] text-[#334155]">{label}</span>
              <strong className="block font-display text-[30px] leading-tight">{value}</strong>
            </span>
          </Link>
        ))}
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Waiting for your approval" href="/manage?view=repairs">
          {waiting.length === 0 ? (
            <Quiet>No prices are waiting for your answer.</Quiet>
          ) : (
            <>
              <p className="-mt-2 mb-2 text-[12.5px] text-[#475569]">
                {waiting.length} {waiting.length === 1 ? "price" : "prices"} from pros. A job cannot start until you answer.
              </p>
              <ul className="space-y-1.5">
                {waiting.slice(0, 3).map(({ quote, repair }) => (
                  <Approval key={quote.id} quote={quote} repair={repair} where={where(repair)} now={now} />
                ))}
              </ul>
            </>
          )}
        </Panel>

        <Panel title="Today's visits" href="/manage?view=repairs">
          {schedule.today.length === 0 ? <Quiet>No pros are booked for today.</Quiet> : <Visits visits={schedule.today} byJob={byJob} where={where} />}
          {schedule.later.length > 0 ? (
            <>
              <h3 className="mb-1.5 mt-3 text-[12.5px] font-bold uppercase tracking-wide text-[#5B6880]">Coming up</h3>
              <Visits visits={schedule.later.slice(0, 3)} byJob={byJob} where={where} showDay />
            </>
          ) : null}
        </Panel>
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_1.15fr]">
        <Panel title="Maintenance spending">
          <div className="flex items-start justify-between gap-3">
            <div>
              <strong className="block font-display text-[34px] leading-none">{money(months[months.length - 1].cents)}</strong>
              <span className="text-[13.5px] text-[#475569]">Agreed this month</span>
            </div>
            {change === null ? null : (
              <span className="rounded-lg bg-[#FFEFCF] px-3 py-2 text-center text-[13px] font-bold text-[#8A4B00]">
                <span className="flex items-center justify-center gap-1 text-[15px]">
                  {change < 0 ? <ArrowDown className="h-4 w-4" aria-label="Down" /> : <ArrowUp className="h-4 w-4" aria-label="Up" />}
                  {Math.abs(change)}%
                </span>
                <span className="font-medium">vs. last month</span>
              </span>
            )}
          </div>
          <SpendingChart months={months} />
          <p className="mt-2 text-[12px] text-[#5B6880]">Prices you accepted, or the final cost where you recorded one. You pay pros directly.</p>
        </Panel>

        <Panel title="Recent maintenance requests" href="/manage?view=repairs">
          {repairs.length === 0 ? (
            <Quiet>No requests yet.</Quiet>
          ) : (
            <ul className="space-y-2">
              {repairs.slice(0, 4).map((repair) => (
                <li key={repair.id}>
                  <Link href={repairHref(repair.id)} className="flex flex-wrap items-center gap-3 rounded-xl border border-[#E4E9F1] p-2.5 hover:border-[#F26B1D]">
                    <span className="grid h-11 w-12 flex-none place-items-center rounded-lg bg-[#E8EDF5] text-[#33466B]">
                      <Wrench className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-[14.5px]">{repair.title}</strong>
                      <span className="block truncate text-[12.5px] text-[#475569]">{where(repair)} • {ago(repair.created_at, now)}</span>
                    </span>
                    <StatusPill status={repair.status} />
                    <ChevronRight className="h-4 w-4 flex-none" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <Panel title="Properties" href="/manage?view=properties">
          {active.length === 0 ? (
            <Quiet>
              Start by <Link href="/manage?view=properties" className="font-bold text-[#1457C0] hover:underline">adding your first property</Link>.
            </Quiet>
          ) : (
            <ul className="space-y-2">
              {active.slice(0, 3).map((property) => {
                const count = repairs.filter((r) => r.property_id === property.id && !["completed", "cancelled"].includes(r.status)).length;
                const photo = property.photo_path ? photos[property.photo_path] : undefined;
                return (
                  <li key={property.id}>
                    <Link href="/manage?view=properties" className="flex items-center gap-3 rounded-xl border border-[#E4E9F1] p-2 hover:border-[#F26B1D]">
                      <span className="grid h-[64px] w-[92px] flex-none place-items-center overflow-hidden rounded-lg bg-gradient-to-b from-[#D6E4F7] to-[#B9C7E3] text-white">
                        {photo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={photo} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <Building2 className="h-8 w-8" aria-hidden="true" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <strong className="block truncate text-[15px]">{property.name}</strong>
                        <span className="flex items-center gap-1.5 text-[13px] text-[#475569]">
                          <MapPin className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
                          <span className="truncate">{property.city}</span>
                        </span>
                      </span>
                      <span className="flex-none rounded-lg bg-[#FFF0E3] px-2.5 py-1.5 text-[12px] font-bold text-[#9A3D06]">{count} open</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title="Request status">
          <StatusRing parts={parts} completed={completedThisMonth(repairs, now)} />
        </Panel>
      </div>
    </>
  );
}

function Approval({ quote, repair, where, now }: { quote: JobQuote; repair: Repair; where: string; now: Date }) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const accept = useMutation({
    mutationFn: () => respondToQuote({ quoteId: quote.id, response: "accepted" }),
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["manage"] }),
        queryClient.invalidateQueries({ queryKey: ["my-requests"] }),
      ]);
    },
  });
  const urgent = repair.priority === "urgent";
  const expired = validity(quote, now) === "expired";
  const lines = quoteLines(quote).map((line) => `${line.label} ${money(line.cents)}`).join(" • ");
  const small = "rounded-md px-3 py-1 text-[12.5px] font-bold";
  return (
    <li className={`rounded-lg border px-2.5 py-2 ${urgent ? "border-[#F3B9B5] bg-[#FFF6F5]" : "border-[#E4E9F1]"}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          {urgent ? <AlertTriangle className="h-3.5 w-3.5 flex-none text-[#B42318]" aria-label="Urgent" /> : null}
          <Link href={repairHref(repair.id)} className="truncate text-[13.5px] font-bold hover:underline">{repair.title}</Link>
        </span>
        <strong className="flex-none font-display text-[16px] leading-tight tabular-nums">{money(quote.amount_cents)}</strong>
      </div>
      <p className="text-[12px] text-[#475569]">
        {where} • <strong className="font-semibold text-[#0B1B33]">{quote.provider_name ?? "A local pro"}</strong>
      </p>
      <p className="text-[11.5px] text-[#475569]">{lines}</p>
      <div className="mt-1 flex flex-wrap items-center justify-end gap-1.5">
        {expired ? <span className="mr-auto text-[12px] font-bold text-[#B42318]">This price has expired</span> : null}
        {confirming ? (
          <>
            <span className="mr-auto text-[12px] font-bold">Accept {money(quote.amount_cents)}?</span>
            <button type="button" disabled={accept.isPending} onClick={() => accept.mutate()} className={`${small} bg-[#17743C] text-white disabled:opacity-60`}>
              {accept.isPending ? "Accepting…" : "Yes, accept"}
            </button>
            <button type="button" onClick={() => setConfirming(false)} className={`${small} border border-[#C9D3E3] bg-white text-[#33466B]`}>Not yet</button>
          </>
        ) : (
          <>
            {expired ? null : (
              <button type="button" onClick={() => setConfirming(true)} className={`${small} bg-[#17743C] text-white`}>Accept</button>
            )}
            {/* Declining needs a reason, which the repair's own page asks for. */}
            <Link href={repairHref(repair.id)} className={`${small} border border-[#C9D3E3] bg-white text-[#33466B]`}>Details or decline</Link>
          </>
        )}
      </div>
      {accept.isError ? <p role="alert" className="mt-1 text-[12px] text-[#B42318]">{(accept.error as Error).message}</p> : null}
    </li>
  );
}

function Visits({
  visits,
  byJob,
  where,
  showDay = false,
}: {
  visits: OverviewVisit[];
  byJob: Map<string, Repair>;
  where: (repair: Repair) => string;
  showDay?: boolean;
}) {
  return (
    <ul className="space-y-1.5">
      {visits.map((visit) => {
        const repair = byJob.get(visit.quote_request_id);
        const date = new Date(visit.scheduled_for);
        return (
          <li key={visit.id}>
            <Link href={repair ? repairHref(repair.id) : "/manage?view=repairs"} className="flex items-center gap-2.5 rounded-lg border border-[#E4E9F1] px-2.5 py-2 hover:border-[#F26B1D]">
              <span className="w-[76px] flex-none rounded-md bg-[#DDEBFE] py-1 text-center text-[12.5px] font-bold tabular-nums text-[#1457C0]">
                {showDay ? <span className="block">{date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span> : null}
                {date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block truncate text-[13.5px]">{repair ? where(repair) : visit.title}</strong>
                <span className="flex items-center gap-1 text-[12px] text-[#475569]">
                  <HardHat className="h-3.5 w-3.5 flex-none text-[#B4470A]" aria-label="Pro" />
                  <span className="truncate">{visit.provider_name ?? "Your pro"} • {visit.title}</span>
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function SpendingChart({ months }: { months: MonthTotal[] }) {
  const top = axisTop(Math.max(...months.map((month) => month.cents)));
  const ticks = [1, 0.75, 0.5, 0.25, 0].map((share) => top * share);
  return (
    <div className="mt-4 flex gap-3 text-[12px] text-[#5B6880]">
      <div className="flex h-[160px] flex-col justify-between text-right tabular-nums" aria-hidden="true">
        {ticks.map((tick) => (
          <span key={tick} className="leading-none">${tick.toLocaleString("en-US")}</span>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <div className="relative h-[160px]">
          <div className="absolute inset-0 flex flex-col justify-between" aria-hidden="true">
            {ticks.map((tick) => (
              <span key={tick} className="block h-px bg-[#E4E9F1]" />
            ))}
          </div>
          <div className="relative flex h-full items-end justify-around">
            {months.map((month, index) => (
              <div
                key={month.key}
                title={`${month.label}: ${money(month.cents)}`}
                className={`w-[11%] min-w-[18px] rounded-t-[4px] hover:opacity-80 ${index === months.length - 1 ? "bg-[#F26B1D]" : "bg-[#A9C1E6]"}`}
                style={{ height: `${(month.cents / 100 / top) * 100}%` }}
              />
            ))}
          </div>
        </div>
        <div className="mt-2 flex justify-around">
          {months.map((month) => (
            <span key={month.key} className="w-[11%] min-w-[18px] text-center">{month.label}</span>
          ))}
        </div>
      </div>
      <table className="sr-only">
        <caption>Maintenance spending by month</caption>
        <tbody>
          {months.map((month) => (
            <tr key={month.key}>
              <th scope="row">{month.label}</th>
              <td>{money(month.cents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusRing({ parts, completed }: { parts: StatusPart[]; completed: number }) {
  const total = parts.reduce((sum, part) => sum + part.count, 0);
  const radius = 62;
  const around = 2 * Math.PI * radius;
  let before = 0;
  const rows = [...parts, { label: "Completed this month", colour: "#2FA84F", count: completed }];
  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg width="160" height="160" viewBox="0 0 160 160" role="img" aria-label={`${total} open requests`}>
        <circle cx="80" cy="80" r={radius} fill="none" stroke="#E9EEF6" strokeWidth="24" />
        <g transform="rotate(-90 80 80)">
          {parts.filter((part) => part.count > 0).map((part) => {
            const length = (part.count / total) * around;
            const offset = before;
            before += length;
            const gap = part.count === total ? 0 : 2;
            return (
              <circle key={part.label} cx="80" cy="80" r={radius} fill="none" stroke={part.colour} strokeWidth="24" strokeDasharray={`${length - gap} ${around - length + gap}`} strokeDashoffset={-offset}>
                <title>{`${part.label}: ${part.count}`}</title>
              </circle>
            );
          })}
        </g>
        <text x="80" y="80" textAnchor="middle" className="fill-[#0B1B33] text-[26px] font-bold">{total}</text>
        <text x="80" y="100" textAnchor="middle" className="fill-[#0B1B33] text-[13px]">Open</text>
      </svg>
      <ul className="min-w-[180px] flex-1 text-[14px]">
        {rows.map((part) => (
          <li key={part.label} className="flex items-center gap-3 border-b border-[#EDF1F7] py-2 last:border-b-0">
            <span className="h-3 w-3 flex-none rounded-full" style={{ background: part.colour }} aria-hidden="true" />
            <span className="flex-1">{part.label}</span>
            <strong className="tabular-nums">{part.count}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}
