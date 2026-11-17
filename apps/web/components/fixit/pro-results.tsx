import Link from "next/link";
import { ProCard } from "@/components/fixit/pro-card";
import type { ProSummary } from "@/lib/fixit";
import type { AvailabilityFilter } from "@/lib/fixit-live-availability";

const FILTERS: Array<{ key: AvailabilityFilter; label: string; help: string }> = [
  { key: "any", label: "All pros", help: "Everyone who works in this trade" },
  { key: "today", label: "Available today", help: "Open at some point today" },
  { key: "tomorrow", label: "Available tomorrow", help: "Open at some point tomorrow" },
  { key: "emergency", label: "Emergency now", help: "Taking emergency calls right now" },
];

/** A link back to this list with a different filter or page. */
function listHref(basePath: string, city: string | null, filter: AvailabilityFilter, page: number): string {
  const params = new URLSearchParams();
  if (city) params.set("city", city);
  if (filter !== "any") params.set("when", filter);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

/**
 * The list a homeowner actually shops from. The professionals arrive already
 * ranked (who can help soonest, then paid placement, then rating) and already
 * cut to the pages the visitor has opened. The filters and "Show more" are
 * plain links, so the whole list is ranked on the server and every professional
 * can be reached however many there are.
 */
export function ProResults({
  pros,
  counts,
  total,
  filter,
  page,
  hasMore,
  basePath,
  city,
}: {
  pros: ProSummary[];
  counts: Record<AvailabilityFilter, number>;
  total: number;
  filter: AvailabilityFilter;
  page: number;
  hasMore: boolean;
  basePath: string;
  city: string | null;
}) {
  const now = new Date();
  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Filter by availability">
        {FILTERS.map((option) => {
          const active = filter === option.key;
          return (
            <Link
              key={option.key}
              href={listHref(basePath, city, option.key, 1)}
              scroll={false}
              aria-current={active ? "true" : undefined}
              title={option.help}
              className={
                "rounded-full border px-4 py-2 text-[13px] font-bold transition-colors " +
                (active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground/70 hover:border-primary")
              }
            >
              {option.label}
              <span className={"ml-1.5 tabular-nums " + (active ? "opacity-80" : "text-muted-foreground")}>
                {counts[option.key]}
              </span>
            </Link>
          );
        })}
      </div>

      {pros.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <h2 className="mb-2 font-display text-xl font-semibold">
            {filter === "emergency"
              ? "No one is on emergency call right now"
              : "No pros match that availability"}
          </h2>
          <p className="mx-auto max-w-[520px] text-sm leading-relaxed text-muted-foreground">
            {filter === "emergency"
              ? "Emergency cover depends on who is on shift. Send your request anyway — it reaches every matching pro in your area, and it is flagged so the first one free picks it up."
              : "Try another day, or send your request and matching pros will respond as their hours allow."}
          </p>
          <Link
            href={listHref(basePath, city, "any", 1)}
            className="mt-5 inline-block rounded-md border border-border bg-card px-5 py-2.5 text-sm font-bold text-foreground/80 hover:border-primary"
          >
            Show all pros
          </Link>
        </div>
      ) : (
        <>
          {/* A fixed grid: every card is the same size, and a lone last card does
              not stretch across the row. */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {pros.map((pro) => (
              <ProCard key={pro.id} pro={pro} now={now} />
            ))}
          </div>
          <div className="mt-8 flex flex-col items-center gap-3">
            <p className="text-[13px] text-muted-foreground">
              Showing {pros.length} of {total}
            </p>
            {hasMore ? (
              <Link
                href={listHref(basePath, city, filter, page + 1)}
                scroll={false}
                rel="nofollow"
                className="rounded-md border border-primary px-6 py-3 text-sm font-bold text-primary hover:bg-primary/5"
              >
                Show more professionals
              </Link>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
