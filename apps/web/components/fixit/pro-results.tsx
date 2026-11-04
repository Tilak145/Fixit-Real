"use client";

import { useMemo, useState } from "react";
import { ProCard, factsOf } from "@/components/fixit/pro-card";
import {
  compareByAvailability,
  matchesAvailabilityFilter,
  type AvailabilityFilter,
} from "@/lib/fixit-live-availability";
import type { ProSummary } from "@/lib/fixit";

const FILTERS: Array<{ key: AvailabilityFilter; label: string; help: string }> = [
  { key: "any", label: "All pros", help: "Everyone who works in this trade" },
  { key: "today", label: "Available today", help: "Open at some point today" },
  { key: "tomorrow", label: "Available tomorrow", help: "Open at some point tomorrow" },
  { key: "emergency", label: "Emergency now", help: "Taking emergency calls right now" },
];

/**
 * The list a homeowner actually shops from: a filter that answers "who can come
 * soon", and cards ranked by who can help soonest. The times are judged in the
 * customer's browser so "today" means today for them, and the rule itself lives
 * in one tested place rather than in this component.
 */
export function ProResults({ pros }: { pros: ProSummary[] }) {
  const [filter, setFilter] = useState<AvailabilityFilter>("any");
  // One instant for the whole render, so every card and the sort agree. It is
  // captured once per mount rather than per card.
  const now = useMemo(() => new Date(), []);

  const shown = useMemo(
    () =>
      pros
        .filter((pro) => matchesAvailabilityFilter(factsOf(pro), filter, now))
        .sort((a, b) =>
          compareByAvailability(
            { facts: factsOf(a), rating: a.rating ?? 0, placement: a.placement },
            { facts: factsOf(b), rating: b.rating ?? 0, placement: b.placement },
            now,
          ),
        ),
    [pros, filter, now],
  );

  const counts = useMemo(() => {
    const result: Record<AvailabilityFilter, number> = { any: 0, today: 0, tomorrow: 0, emergency: 0 };
    for (const key of Object.keys(result) as AvailabilityFilter[]) {
      result[key] = pros.filter((pro) => matchesAvailabilityFilter(factsOf(pro), key, now)).length;
    }
    return result;
  }, [pros, now]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Filter by availability">
        {FILTERS.map((option) => {
          const active = filter === option.key;
          return (
            <button
              key={option.key}
              type="button"
              aria-pressed={active}
              title={option.help}
              onClick={() => setFilter(option.key)}
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
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
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
          <button
            type="button"
            onClick={() => setFilter("any")}
            className="mt-5 rounded-md border border-border bg-card px-5 py-2.5 text-sm font-bold text-foreground/80 hover:border-primary"
          >
            Show all pros
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-6">
          {shown.map((pro) => (
            <ProCard key={pro.id} pro={pro} now={now} />
          ))}
        </div>
      )}
    </div>
  );
}
