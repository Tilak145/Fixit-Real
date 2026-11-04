import Link from "next/link";
import { MapPin } from "lucide-react";
import type { ProSummary } from "@/lib/fixit";
import {
  availabilityLabel,
  availabilityState,
  MARKET_TIMEZONE,
  type AvailabilityFacts,
} from "@/lib/fixit-live-availability";

export function Stars({ rating }: { rating: number }) {
  const full = Math.round(rating);
  return (
    <span className="text-[15px] tracking-[2px] text-[#F5A623]" aria-label={`Rated ${rating} out of 5`}>
      {"★".repeat(full)}
      <span className="text-[#E3E8EF]">{"★".repeat(5 - full)}</span>
    </span>
  );
}

/** The availability facts a card needs, read from the pro it shows. */
export function factsOf(pro: ProSummary): AvailabilityFacts {
  return {
    // Absent means the row was not loaded with the field; default to on so a
    // missing value never quietly hides a working professional.
    acceptingWork: pro.acceptingWork ?? true,
    acceptsEmergency: Boolean(pro.acceptsEmergency),
    windows: pro.hours ?? [],
  };
}

/** The badge on a pro's photo. It says only what the schedule supports. */
export function AvailabilityBadge({ pro, now }: { pro: ProSummary; now: Date }) {
  const facts = factsOf(pro);
  const state = availabilityState(facts, now);
  const style =
    state === "available"
      ? "bg-[#2E9E4F] text-white"
      : state === "open-later"
        ? "bg-[#B26A00] text-white"
        : "bg-[#4A5568] text-white";
  return (
    <span
      className={"absolute bottom-2.5 left-2.5 rounded-md px-2.5 py-1 text-[11.5px] font-bold " + style}
      title={`Times are shown in ${MARKET_TIMEZONE.replace("_", " ")}`}
    >
      {availabilityLabel(facts, now)}
    </span>
  );
}

export function ProCard({ pro, now = new Date() }: { pro: ProSummary; now?: Date }) {
  return (
    <div className="flex min-w-[260px] flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
      <div className="relative h-[180px] bg-muted">
        {pro.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={pro.logo_url}
            alt={pro.business_name}
            width={520}
            height={360}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-display text-3xl font-bold text-primary/40">
            {pro.business_name.slice(0, 2).toUpperCase()}
          </div>
        )}
        <AvailabilityBadge pro={pro} now={now} />
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="font-display text-[17px] font-semibold text-foreground">{pro.business_name}</div>
        <div className="mb-3 mt-1.5 flex items-center gap-2">
          {pro.review_count > 0 ? (
            <>
              <Stars rating={pro.rating} />
              <strong className="text-sm text-foreground">{pro.rating.toFixed(1)}</strong>
              <span className="text-[13px] text-muted-foreground">({pro.review_count})</span>
            </>
          ) : (
            <span className="text-[13px] font-semibold text-muted-foreground">New on FixIt · No reviews yet</span>
          )}
        </div>
        <div className="mt-auto flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
            {pro.city}
          </span>
          <Link
            href={`/pros/${pro.id}`}
            className="rounded-md bg-primary px-4 py-2.5 text-[13.5px] font-bold text-primary-foreground hover:bg-primary/90"
          >
            View Profile
          </Link>
        </div>
      </div>
    </div>
  );
}
