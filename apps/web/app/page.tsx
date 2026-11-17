import Link from "next/link";
import { ArrowRight, BadgeCheck, Check, FileText, Lock, MapPin, Star } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/fixit/site-chrome";
import { ProCard } from "@/components/fixit/pro-card";
import { AutoRefresh } from "@/components/fixit/auto-refresh";
import { listCategories, listPros, listCategoryProCounts, resolveVisitorCity, isBackendConfigured } from "@/lib/fixit-server";
import { ServiceIcon, CORE_CATEGORIES } from "@/components/fixit/service-icons";
import { HeroSearch } from "@/components/fixit/hero-search";

export const dynamic = "force-dynamic";

async function getHomeData(cityParam?: string) {
  if (!(await isBackendConfigured())) {
    return {
      configured: false as const,
      categories: CORE_CATEGORIES.map((c, i) => ({ ...c, icon: c.slug, sort_order: i, pros: 0, availableNow: 0 })),
      pros: [] as const,
      cities: [] as { label: string; is_active: boolean }[],
      chosenCity: null as string | null,
    };
  }
  // Only the cities the owner has made bookable are offered here. The city the
  // visitor is shopping in is the one in the URL, else the one they picked
  // before, else the first city served.
  const { cities, chosenCity } = await resolveVisitorCity(cityParam);
  const [categories, localPros, counts] = await Promise.all([
    listCategories(),
    // Top pros are the ones who cover the chosen city, so "near you" is true.
    listPros(chosenCity ? { city: chosenCity } : {}),
    listCategoryProCounts(chosenCity),
  ]);
  // Always show at least the ten launch categories, in the design's order.
  const merged = CORE_CATEGORIES.map((c, i) => {
    const db = categories.find((d) => d.slug === c.slug);
    return {
      ...(db ?? { ...c, icon: c.slug, sort_order: i }),
      pros: counts[c.slug]?.total ?? 0,
      availableNow: counts[c.slug]?.availableNow ?? 0,
    };
  });
  const offered = cities.map((city) => ({ label: city.label, is_active: city.is_active }));
  return {
    configured: true as const,
    categories: merged,
    pros: localPros.slice(0, 4),
    cities: offered,
    chosenCity,
  };
}

const STEPS = [
  {
    title: "Describe the job",
    text: "Tell us what's wrong and where you are. Add photos or a short video so pros can see the problem.",
  },
  {
    title: "Compare itemized quotes",
    text: "Matching local pros send their price, with labor, materials, timing and warranty laid out side by side.",
  },
  {
    title: "Choose your pro",
    text: "Accept the quote you want. The others close, and only your chosen pro receives your contact details.",
  },
];

// Each of these is a rule the product enforces, not a marketing claim. Keep them
// that way: a line belongs here only if the site really does it.
const PROMISES = [
  {
    icon: BadgeCheck,
    title: "“Verified” means checked",
    text: "A pro earns the badge only after a person confirms their license with the state register and reviews their insurance certificate.",
  },
  {
    icon: FileText,
    title: "Prices you can compare",
    text: "Every quote is broken down the same way, so differences and gaps are easy to spot before you decide.",
  },
  {
    icon: Star,
    title: "Reviews from finished jobs",
    text: "Only a customer whose job with that pro is complete can review them, so ratings come from real work.",
  },
  {
    icon: Lock,
    title: "Your details stay private",
    text: "Your phone number and address go only to the pro you choose. No cold calls from everyone else.",
  },
];

// A trial: each service icon gets its own color. A service not listed here
// keeps the site's blue. The tinted square behind it is the same color at 13%.
const SERVICE_COLORS: Record<string, string> = {
  plumbing: "#1565C0",
  electrical: "#D97706",
  hvac: "#0891B2",
  "garage-doors": "#4F46E5",
  roofing: "#DC2626",
  "appliance-repair": "#7C3AED",
  handyman: "#EA580C",
  cleaning: "#0D9488",
  "pest-control": "#BE185D",
  landscaping: "#16A34A",
};

const PRO_BENEFITS = [
  "First 100 pros get 1 month free",
  "A flat monthly fee, never charged per lead",
  "See the job, location and budget before you quote",
];

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string }>;
}) {
  const { city: cityParam } = await searchParams;
  const { configured, categories, pros, cities, chosenCity } = await getHomeData(cityParam);
  // Point "see more" at a category that has professionals behind it.
  // Service links carry the city, so the list they open is that city's.
  const cityQuery = chosenCity ? `?city=${encodeURIComponent(chosenCity)}` : "";
  const browseHref = `/services/${(categories.find((c) => c.pros > 0) ?? categories[0]).slug}${cityQuery}`;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AutoRefresh everyMinutes={2} />
      <SiteHeader city={chosenCity} />

      {/* Hero. The photo stops where the page content stops; on screens wider
          than that it becomes a rounded panel instead of stretching edge to edge. */}
      <section className="relative mx-auto w-full max-w-[1280px] overflow-hidden bg-secondary min-[1281px]:mt-4 min-[1281px]:rounded-2xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/e14a1b0b0af57e57cf93da2d6c9b64bbd74a0dc88e8d1c45c98610181f8d9b63.jpg"
          alt=""
          width={2688}
          height={1512}
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(100deg, rgba(10,22,42,.94) 0%, rgba(10,22,42,.82) 45%, rgba(10,22,42,.5) 100%)",
          }}
        />
        <div className="relative mx-auto grid max-w-[1280px] items-center gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:grid-cols-[minmax(0,1fr)_416px] lg:gap-16 lg:py-6">
          <div className="text-white">
            {chosenCity ? (
              <p className="mb-3 flex items-center gap-2 text-sm font-bold text-[#F59A3D]">
                <MapPin className="h-4 w-4" aria-hidden="true" />
                Home services in {chosenCity}
              </p>
            ) : null}
            <h1 className="mb-3 max-w-[440px] font-display text-[26px] font-bold leading-[1.1] tracking-tight sm:text-[30px] lg:text-[32px]">
              Find a local pro you can trust with your home
            </h1>
            <p className="mb-5 max-w-[500px] text-[15px] leading-relaxed text-[#DCE6F2] sm:mb-6 sm:text-base">
              Describe your job once, compare itemized quotes from local professionals, and choose the right one.
            </p>
            <ul className="flex flex-wrap gap-x-5 gap-y-2 sm:gap-x-7">
              {["Free to request", "No obligation", "No cold calls"].map((label) => (
                <li key={label} className="flex items-center gap-2 text-[15px] font-semibold">
                  <Check className="h-[18px] w-[18px] flex-none text-[#F59A3D]" aria-hidden="true" />
                  {label}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl bg-card p-5 text-card-foreground shadow-2xl sm:p-6">
            <h2 className="mb-1 font-display text-xl font-semibold">Get free quotes</h2>
            <p className="mb-4 text-sm text-muted-foreground">Tell us about your job. It only takes a minute.</p>
            <HeroSearch cities={cities} chosenCity={chosenCity} />
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="mx-auto w-full max-w-[1280px] scroll-mt-20 px-4 py-6 sm:px-6 lg:py-8">
        <h2 className="mb-0.5 font-display text-xl font-semibold sm:text-[22px]">What can we help you fix?</h2>
        <p className="mb-4 text-sm text-muted-foreground">Choose a service to get started.</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2.5 lg:grid-cols-5">
          {categories.map((c) => (
            <Link
              key={c.slug}
              href={`/services/${c.slug}${cityQuery}`}
              className="group flex min-h-[52px] items-center gap-2.5 rounded-xl border border-border bg-card px-2.5 py-2 outline-none ring-ring transition hover:border-primary hover:shadow-md focus-visible:ring-2 sm:px-3"
            >
              <span
                className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-primary/10 text-primary"
                style={
                  SERVICE_COLORS[c.slug]
                    ? { color: SERVICE_COLORS[c.slug], backgroundColor: `${SERVICE_COLORS[c.slug]}22` }
                    : undefined
                }
              >
                <ServiceIcon name={c.slug} className="h-[18px] w-[18px]" aria-hidden="true" />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="font-display text-[13px] font-semibold leading-tight text-foreground sm:text-sm">{c.name}</span>
                {/* A service with no pros yet opens its waitlist, so the card still leads somewhere. */}
                {/* Only professionals who can be reached this minute are counted,
                    so the card never promises someone who is not working. */}
                {c.availableNow > 0 ? (
                  <span className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-[#1E7B3C]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#2E9E4F]" aria-hidden="true" />
                    {c.availableNow} available now
                  </span>
                ) : c.pros > 0 ? (
                  <span className="mt-0.5 text-xs text-muted-foreground">No one available right now</span>
                ) : null}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-20 border-y border-border bg-card py-14 lg:py-20">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
          <h2 className="mb-2 font-display text-[28px] font-semibold sm:text-[32px]">How FixIt works</h2>
          <p className="mb-10 text-base text-muted-foreground">Three steps, with no phone calls to chase.</p>
          <ol className="grid gap-8 md:grid-cols-3 md:gap-10">
            {STEPS.map((step, index) => (
              <li key={step.title} className="relative">
                {index < STEPS.length - 1 ? (
                  <span aria-hidden="true" className="absolute left-14 right-[-20px] top-5 hidden h-px bg-border md:block" />
                ) : null}
                <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-primary font-display text-base font-semibold text-primary-foreground">
                  {index + 1}
                </span>
                <h3 className="mb-2 font-display text-lg font-semibold">{step.title}</h3>
                <p className="max-w-[360px] text-[15px] leading-relaxed text-muted-foreground">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Why FixIt */}
      <section className="mx-auto grid w-full max-w-[1280px] items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[440px_minmax(0,1fr)] lg:gap-16 lg:py-20">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/cac346852d56c22dda280cbbb86392d83ec74ab6dbea19d462325fc89f7458a9.jpg"
          alt="A plumber repairing the pipes under a kitchen sink"
          width={1920}
          height={2560}
          loading="lazy"
          className="aspect-[4/3] w-full rounded-xl object-cover object-[center_60%] lg:aspect-[4/5]"
        />
        <div>
          <h2 className="mb-2 font-display text-[28px] font-semibold sm:text-[32px]">Built on proof, not promises</h2>
          <p className="mb-8 max-w-[560px] text-base leading-relaxed text-muted-foreground">
            Letting someone into your home takes trust. Here is what FixIt does to earn it.
          </p>
          <div className="grid gap-x-8 gap-y-7 sm:grid-cols-2">
            {PROMISES.map(({ icon: Icon, title, text }) => (
              <div key={title}>
                <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mb-1.5 font-display text-base font-semibold">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Local pros */}
      <section className="border-t border-border bg-card py-14 lg:py-20">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
          {!configured ? (
            <p className="rounded-lg border border-border bg-background p-6 text-sm text-muted-foreground">
              Provider profiles are unavailable because data services are not connected yet.
            </p>
          ) : pros.length > 0 ? (
            <>
              <div className="mb-8 flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="font-display text-[28px] font-semibold sm:text-[32px]">
                  Professionals {chosenCity ? `in ${chosenCity}` : "near you"}
                </h2>
                <Link href={browseHref} className="text-sm font-bold text-primary hover:underline">
                  See more professionals
                </Link>
              </div>
              <div className="flex flex-wrap gap-6">
                {pros.map((p) => (
                  <ProCard key={p.id} pro={p} />
                ))}
              </div>
            </>
          ) : (
            <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-16">
              <div>
                <h2 className="mb-2 font-display text-[28px] font-semibold sm:text-[32px]">
                  {chosenCity ? `We're adding professionals in ${chosenCity}` : "We're adding local professionals"}
                </h2>
                <p className="max-w-[620px] text-base leading-relaxed text-muted-foreground">
                  Post your job now and we will match you as soon as a pro who covers your area joins.
                </p>
                {cities.length > 1 ? (
                  <div className="mt-5 flex flex-wrap gap-2">
                    {cities.map((city) => (
                      <Link
                        key={city.label}
                        href={"/?city=" + encodeURIComponent(city.label)}
                        aria-current={city.label === chosenCity ? "true" : undefined}
                        className={
                          "rounded-full border px-3.5 py-2 text-[13px] font-bold transition " +
                          (city.label === chosenCity
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-foreground/80 hover:border-primary hover:text-primary")
                        }
                      >
                        {city.label}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
              <Link
                href={chosenCity ? "/request?city=" + encodeURIComponent(chosenCity) : "/request"}
                className="inline-flex h-12 items-center justify-center gap-2 justify-self-start whitespace-nowrap rounded-md bg-primary px-7 font-display text-[15px] font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Post your job <ArrowRight className="h-[18px] w-[18px]" aria-hidden="true" />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* For professionals */}
      <section className="bg-secondary py-14 lg:py-20">
        <div className="mx-auto grid max-w-[1280px] items-center gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-16">
          <div>
            <h2 className="mb-3 font-display text-[28px] font-semibold text-white sm:text-[32px]">
              Are you a local service professional?
            </h2>
            <p className="mb-6 max-w-[620px] text-base leading-relaxed text-[#C7D4E5]">
              Get local jobs you choose to quote, and manage leads, visits and reviews in one dashboard.
            </p>
            <ul className="grid gap-3">
              {PRO_BENEFITS.map((benefit) => (
                <li key={benefit} className="flex items-start gap-2.5 text-[15px] font-semibold text-white">
                  <Check className="mt-0.5 h-[18px] w-[18px] flex-none text-[#F59A3D]" aria-hidden="true" />
                  {benefit}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
            <Link
              href="/for-businesses"
              className="inline-flex h-[52px] items-center justify-center gap-2 whitespace-nowrap rounded-md bg-accent px-8 font-display text-base font-semibold text-accent-foreground hover:bg-accent/90"
            >
              List your business <ArrowRight className="h-[18px] w-[18px]" aria-hidden="true" />
            </Link>
            <Link
              href="/pro/dashboard"
              className="inline-flex h-[52px] items-center justify-center whitespace-nowrap rounded-md border border-white/30 px-8 font-display text-base font-semibold text-white hover:bg-white/10"
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
