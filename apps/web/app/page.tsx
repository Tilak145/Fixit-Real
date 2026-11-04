import Link from "next/link";
import { Search, MapPin, Navigation, ShieldCheck, ThumbsUp, Zap, Clock, Users, ArrowRight } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/fixit/site-chrome";
import { ProCard } from "@/components/fixit/pro-card";
import { listCategories, listPros, listCategoryProCounts, listCities, isBackendConfigured } from "@/lib/fixit-server";
import { ServiceIcon, CORE_CATEGORIES } from "@/components/fixit/service-icons";
import { StepIcon } from "@/components/fixit/step-icons";
import { HeroSearch } from "@/components/fixit/hero-search";

export const dynamic = "force-dynamic";

async function getHomeData(cityParam?: string) {
  if (!(await isBackendConfigured())) {
    return {
      configured: false as const,
      categories: CORE_CATEGORIES.map((c, i) => ({ ...c, icon: c.slug, sort_order: i, pros: 0 })),
      pros: [] as const,
      cities: [] as { label: string; is_active: boolean }[],
      chosenCity: null as string | null,
    };
  }
  const [categories, pros, counts, cities] = await Promise.all([
    listCategories(),
    listPros(),
    listCategoryProCounts(),
    listCities(),
  ]);
  // Always show at least the ten launch categories, in the design's order.
  const merged = CORE_CATEGORIES.map((c, i) => {
    const db = categories.find((d) => d.slug === c.slug);
    return { ...(db ?? { ...c, icon: c.slug, sort_order: i }), pros: counts[c.slug] ?? 0 };
  });
  // Only the cities the owner has made bookable are offered here.
  const offered = cities.filter((city) => city.is_active).map((city) => ({ label: city.label, is_active: city.is_active }));
  // The city the visitor is shopping in: the one in the URL, or the first they
  // serve. It decides which professionals are shown first and pre-fills the search.
  const activeLabels = offered.map((city) => city.label);
  const chosenCity = cityParam && activeLabels.includes(cityParam) ? cityParam : activeLabels[0] ?? null;
  // Top pros are the ones who cover the chosen city, so "near you" is true.
  const localPros = chosenCity ? await listPros({ city: chosenCity }) : pros;
  return {
    configured: true as const,
    categories: merged,
    pros: localPros.slice(0, 4),
    cities: offered,
    chosenCity,
  };
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string }>;
}) {
  const { city: cityParam } = await searchParams;
  const { configured, categories, pros, cities, chosenCity } = await getHomeData(cityParam);
  // Point "view all / view more" at a category that has professionals behind it.
  const browseHref = `/services/${(categories.find((c) => c.pros > 0) ?? categories[0]).slug}`;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader city={chosenCity} />

      {/* Hero */}
      <section className="relative bg-secondary">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/e14a1b0b0af57e57cf93da2d6c9b64bbd74a0dc88e8d1c45c98610181f8d9b63.jpg"
          alt=""
          width={2688}
          height={1512}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, rgba(13,24,43,.88) 0%, rgba(13,24,43,.55) 45%, rgba(13,24,43,.25) 100%)",
          }}
        />
        <div className="relative mx-auto flex max-w-[1280px] flex-wrap items-center gap-12 px-6 py-20">
          <div className="min-w-[320px] max-w-[520px] flex-1 text-white">
            <h1 className="mb-5 font-display text-5xl font-bold leading-[1.08]">
              Get Your Home
              <br />
              Fixed <span className="text-[#F59A3D]">Today</span>
            </h1>
            <p className="mb-7 max-w-[480px] text-[19px] leading-relaxed text-[#DCE6F2]">
              Find trusted local professionals for any home service. Fast. Easy. Reliable.
            </p>
            <div className="flex flex-wrap gap-9">
              {[
                { icon: ShieldCheck, label: "Licence & Insurance Checks" },
                { icon: ThumbsUp, label: "Real Customer Reviews" },
                { icon: Zap, label: "Fast Response" },
                { icon: MapPin, label: "Local Experts" },
              ].map(({ icon: Icon, label }) => (
                <span key={label} className="flex items-center gap-2.5 text-sm font-bold">
                  <Icon className="h-[22px] w-[22px]" aria-hidden="true" />
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div className="min-w-[320px] max-w-[480px] flex-1 rounded-2xl bg-card p-8 shadow-2xl">
            <h2 className="mb-1.5 text-center font-display text-2xl font-semibold">What do you need help with?</h2>
            <p className="mb-5 text-center text-[13.5px] text-muted-foreground">
              Tell us what&apos;s wrong and we&apos;ll find the right local pros.
            </p>
            <HeroSearch cities={cities} chosenCity={chosenCity} />
            <div className="mt-5 flex flex-wrap justify-between gap-2 border-t border-border pt-4">
              {[
                { icon: Clock, label: "Get matched in minutes" },
                { icon: Users, label: "Compare local pros" },
                { icon: ShieldCheck, label: "No obligation quotes" },
              ].map(({ icon: Icon, label }) => (
                <span key={label} className="flex items-center gap-1.5 text-[12.5px] font-semibold text-muted-foreground">
                  <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Popular services */}
      <section id="services" className="mx-auto w-full max-w-[1280px] px-6 pb-12 pt-14">
        <div className="mb-6 flex items-baseline justify-between">
          <h2 className="font-display text-[28px] font-semibold">Popular Home Services</h2>
          <Link href={browseHref} className="text-sm font-bold text-primary hover:underline">
            View All Services →
          </Link>
        </div>
        <div className="flex flex-wrap gap-4">
          {categories.map((c) =>
            c.pros > 0 ? (
              <Link
                key={c.slug}
                href={`/services/${c.slug}`}
                className="flex w-[122px] flex-1 flex-col items-center rounded-xl border border-border bg-card px-2.5 pb-4 pt-5 text-center shadow-sm transition-colors hover:border-primary"
              >
                <ServiceIcon name={c.icon} className="mb-2.5 h-[34px] w-[34px] text-primary" aria-hidden="true" />
                <span className="text-[13px] font-bold text-foreground/80">{c.name}</span>
              </Link>
            ) : (
              /* No professional offers this service yet, so it is not bookable. */
              <div
                key={c.slug}
                aria-disabled="true"
                className="flex w-[122px] flex-1 cursor-not-allowed flex-col items-center rounded-xl border border-dashed border-border bg-card/60 px-2.5 pb-4 pt-5 text-center"
              >
                <ServiceIcon name={c.icon} className="mb-2.5 h-[34px] w-[34px] text-muted-foreground/50" aria-hidden="true" />
                <span className="text-[13px] font-bold text-muted-foreground">{c.name}</span>
                <span className="mt-1 rounded-full bg-muted px-2 py-0.5 text-[12px] font-bold uppercase tracking-wide text-muted-foreground">
                  Coming soon
                </span>
              </div>
            ),
          )}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="bg-[#E9F1FB] px-6 py-14">
        <div className="mx-auto max-w-[1280px]">
          <h2 className="mb-9 font-display text-[28px] font-semibold">How FixIt Works</h2>
          <div className="flex flex-wrap items-start gap-6">
            {[
              {
                n: "1",
                title: "Tell Us What You Need",
                text: "Describe the problem and provide your location.",
              },
              { n: "2", title: "Get Matched", text: "We find trusted local professionals for you." },
              {
                n: "3",
                title: "Choose & Get It Done",
                text: "Compare quotes, read reviews and hire the best pro.",
              },
            ].map((s, i) => (
              <div key={s.n} className="flex min-w-[280px] flex-1 items-start gap-4">
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-primary text-[15px] font-bold text-primary-foreground">
                  {s.n}
                </span>
                                <span className="flex h-[72px] w-[72px] flex-none items-center justify-center rounded-full bg-card shadow-md">
                  <StepIcon name={["clipboard", "users", "calendar"][i] ?? "clipboard"} className="h-8 w-8 text-primary" aria-hidden="true" />
                </span>
                <span>
                  <strong className="mb-1 block font-display text-[17px]">{s.title}</strong>
                  <span className="text-sm leading-relaxed text-muted-foreground">{s.text}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Top rated pros */}
      <section className="mx-auto w-full max-w-[1280px] px-6 py-14">
        <div className="mb-6 flex items-baseline justify-between">
          <h2 className="font-display text-[28px] font-semibold">Top Rated Professionals Near You</h2>
          <Link href={browseHref} className="text-sm font-bold text-primary hover:underline">
            View More →
          </Link>
        </div>
        {!configured ? (
          <p className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
            Provider profiles are unavailable because data services are not connected yet.
          </p>
        ) : pros.length === 0 ? (
          <p className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
            {chosenCity && cities.length > 0 ? (
              <>
                No professional covers {chosenCity} yet. Pick another city, or tell us what you need and we
                will match you as soon as one joins —{" "}
                <Link href={"/request?city=" + encodeURIComponent(chosenCity)} className="font-bold text-primary">
                  post your job
                </Link>
                .
              </>
            ) : (
              <>
                No professionals have joined yet. Are you a local pro?{" "}
                <Link href="/for-businesses" className="font-bold text-primary">
                  List your business
                </Link>
                .
              </>
            )}
          </p>
        ) : (
          <div className="flex flex-wrap gap-6">
            {pros.map((p) => (
              <ProCard key={p.id} pro={p} />
            ))}
          </div>
        )}
      </section>

      {/* CTA band */}
      <section className="bg-secondary px-6 py-14">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-8">
          <div>
            <h2 className="mb-2 font-display text-[28px] font-semibold text-white">
              Are you a local service professional?
            </h2>
            <p className="text-base text-[#B9C8DC]">
              Grow your business and get more local customers with FixIt.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/for-businesses"
              className="rounded-md bg-accent px-9 py-4 font-display text-base font-semibold text-accent-foreground hover:bg-accent/90"
            >
              Grow Your Business →
            </Link>
            <Link
              href="/pro/dashboard"
              className="rounded-md border border-white/25 px-9 py-4 font-display text-base font-semibold text-white hover:bg-white/10"
            >
              Pro sign in
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
