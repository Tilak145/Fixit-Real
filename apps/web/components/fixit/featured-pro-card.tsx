import Link from "next/link";
import { MapPin, Sparkles } from "lucide-react";
import type { ProSummary } from "@/lib/fixit";
import { Stars, VerifiedCheck, factsOf } from "@/components/fixit/pro-card";
import { availabilityLabel, availabilityState } from "@/lib/fixit-live-availability";

/**
 * A featured business on the home page: its logo large and centred, so the
 * spot reads as that business's own, with the name, rating and whether it can
 * help now. The whole card opens the profile.
 */
export function FeaturedProCard({ pro, now = new Date() }: { pro: ProSummary; now?: Date }) {
  const facts = factsOf(pro);
  const state = availabilityState(facts, now);
  return (
    <Link
      href={`/pros/${pro.id}`}
      data-testid="featured-pro"
      className="group flex flex-col overflow-hidden rounded-2xl border border-[#F2D9A6] bg-card shadow-sm outline-none ring-ring transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:ring-2"
    >
      <div className="relative flex h-[170px] items-center justify-center bg-[#FFFAF0] p-5">
        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-[#B26A00] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
          <Sparkles className="h-3 w-3" aria-hidden="true" />
          Featured
        </span>
        {pro.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={pro.logo_url}
            alt={pro.business_name}
            width={240}
            height={240}
            loading="lazy"
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-white font-display text-3xl font-bold text-primary/50 shadow-sm">
            {pro.business_name.slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="font-display text-[17px] font-semibold leading-snug text-foreground">
          {pro.business_name}
          {pro.verified ? <VerifiedCheck /> : null}
        </div>
        <div className="mt-1.5 flex items-center gap-2">
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
        <div className="mt-auto flex items-center justify-between gap-2 pt-4 text-[13px]">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
            {pro.city}
          </span>
          <span className={state === "available" ? "font-bold text-[#1E7B3C]" : "font-semibold text-muted-foreground"}>
            {availabilityLabel(facts, now)}
          </span>
        </div>
      </div>
    </Link>
  );
}
