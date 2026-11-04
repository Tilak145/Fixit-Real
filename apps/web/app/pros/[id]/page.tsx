import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, ShieldCheck, ArrowRight } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/fixit/site-chrome";
import { Stars } from "@/components/fixit/pro-card";
import { getPro, getProTrustEvidence, listProReviews } from "@/lib/fixit-server";
import { TrustPanel } from "@/components/fixit/trust-panel";
import { isVerified, trustScore, TRUST_LEVEL_LABEL } from "@/lib/trust-score";
import { ReviewForm } from "@/components/fixit/review-form";
import { describeWeek, isOpenAt } from "@/lib/fixit-availability";
import { Clock } from "lucide-react";

export const dynamic = "force-dynamic";

// The page and its browser-tab title need the same row; read it once.
const loadPro = cache(getPro);

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const pro = await loadPro(id);
  if (!pro) return { title: "Professional not found — FixIt" };
  return { title: `${pro.business_name} — FixIt`, description: pro.description ?? undefined };
}

export default async function ProProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pro = await loadPro(id);
  if (!pro) notFound();
  const [reviews, trust] = await Promise.all([listProReviews(id), getProTrustEvidence(id)]);
  // The badge is earned, not given. A professional is verified only when both
  // the licence and the insurance have actually been checked.
  const verified = trust ? isVerified(trust) : false;
  const trustResult = trust ? trustScore(trust, new Date()) : null;
  const areas = (pro as unknown as { areas?: string[] }).areas ?? [];
  const hours = pro.hours ?? [];
  const openNow = isOpenAt(hours, new Date());

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <section className="mx-auto w-full max-w-[1280px] flex-1 px-6 py-10">
        <div className="flex flex-wrap gap-8">
          <div className="min-w-[300px] flex-1">
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="h-[300px] bg-muted">
                {pro.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={pro.logo_url}
                    alt={pro.business_name}
                    width={900}
                    height={600}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center font-display text-6xl font-bold text-primary/30">
                    {pro.business_name.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="p-6">
                <h1 className="mb-2 font-display text-2xl font-semibold">{pro.business_name}</h1>
                <div className="mb-3 flex items-center gap-2">
                  {pro.review_count > 0 ? (
                    <>
                      <Stars rating={pro.rating} />
                      <strong className="text-sm">{pro.rating.toFixed(1)}</strong>
                      <span className="text-sm text-muted-foreground">
                        ({pro.review_count} {pro.review_count === 1 ? "review" : "reviews"})
                      </span>
                    </>
                  ) : (
                    <span className="text-sm font-semibold text-muted-foreground">New on FixIt · No reviews yet</span>
                  )}
                </div>
                {verified ? (
                  <span className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-[#E6F4EA] px-3 py-1 text-xs font-bold text-[#2E9E4F]">
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Licence &amp; insurance verified
                  </span>
                ) : (
                  // Approval to list is not a check. Saying so plainly is the
                  // honest badge for everyone else.
                  <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-xs font-bold text-muted-foreground">
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    {trustResult ? TRUST_LEVEL_LABEL[trustResult.level] : "Listed professional"}
                  </span>
                )}
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {pro.description ?? "A trusted FixIt professional."}
                </p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {areas.map((c) => (
                    <span key={c} className="rounded-full bg-muted px-3 py-1 text-xs font-bold text-primary">
                      {c}
                    </span>
                  ))}
                </div>
                {hours.length > 0 ? (
                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4 text-sm">
                    <Clock className="h-4 w-4 text-primary" aria-hidden="true" />
                    <span className="font-semibold">{describeWeek(hours)}</span>
                    <span
                      className={
                        "rounded-full px-2.5 py-1 text-[11px] font-bold " +
                        (openNow ? "bg-[#E6F4EA] text-[#2E9E4F]" : "bg-muted text-muted-foreground")
                      }
                    >
                      {openNow ? "Open now" : "Closed now"}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>

            <h2 className="mb-4 mt-8 font-display text-xl font-semibold">Customer Reviews</h2>
            <div className="mb-5">
              <ReviewForm providerId={pro.id} providerName={pro.business_name} />
            </div>
            {reviews.length === 0 ? (
              <p className="rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground">
                No reviews yet — be the first to hire and review this pro.
              </p>
            ) : (
              <div className="space-y-4">
                {reviews.map((r) => (
                  <div key={r.id} className="rounded-lg border border-border bg-card p-4">
                    <div className="flex items-center gap-2">
                      <strong className="text-sm">{r.author_name}</strong>
                      <Stars rating={r.rating} />
                      <span className="text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm text-muted-foreground">{r.comment}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <aside className="w-full max-w-[360px] flex-none">
            <div className="mb-6">
              <TrustPanel evidence={trust} />
            </div>
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <h2 className="mb-1 font-display text-lg font-semibold">Request a quote</h2>
              <p className="mb-5 text-[13px] text-muted-foreground">
                Describe your job and {pro.business_name} will respond with a free quote.
              </p>
              <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 text-accent" aria-hidden="true" />
                Serves {areas.length > 0 ? areas.join(", ") : pro.city}
              </div>
              <Link
                href={`/request?pro=${pro.id}`}
                className="flex h-[50px] w-full items-center justify-center gap-2 rounded-md bg-accent font-display text-base font-semibold text-accent-foreground hover:bg-accent/90"
              >
                Get a Free Quote <ArrowRight className="h-[18px] w-[18px]" aria-hidden="true" />
              </Link>
              <p className="mt-3 text-center text-xs text-muted-foreground">No obligation. No credit card required.</p>
            </div>
          </aside>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
