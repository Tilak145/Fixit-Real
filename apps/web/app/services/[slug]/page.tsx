import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader, SiteFooter } from "@/components/fixit/site-chrome";
import { ProResults } from "@/components/fixit/pro-results";
import { ServiceWaitlist } from "@/components/fixit/service-waitlist";
import { listCategories, listPros, getCategory } from "@/lib/fixit-server";

export const dynamic = "force-dynamic";

// The page and its browser-tab title need the same row; read it once.
const loadCategory = cache(getCategory);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const category = await loadCategory(slug);
  if (!category) return { title: "Service not found — FixIt" };
  return {
    title: `${category.name} Services — FixIt`,
    description: `Trusted ${category.name.toLowerCase()} professionals near you, ready to quote your job.`,
  };
}

export default async function ServiceCategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const category = await loadCategory(slug);
  if (!category) notFound();

  const [pros, categories] = await Promise.all([listPros({ categorySlug: slug }), listCategories()]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <section className="bg-secondary px-6 py-12 text-white">
        <div className="mx-auto max-w-[1280px]">
          <h1 className="mb-2 font-display text-4xl font-bold">{category.name} Services</h1>
          <p className="text-[#DCE6F2]">
            Trusted {category.name.toLowerCase()} professionals near you, ready to quote your job.
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1280px] flex-1 px-6 py-12">
        <div className="mb-8 flex flex-wrap gap-2">
          {categories.map((c) => (
            <Link
              key={c.slug}
              href={`/services/${c.slug}`}
              className={`rounded-full border px-4 py-2 text-[13px] font-bold ${
                c.slug === slug
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground/70 hover:border-primary"
              }`}
            >
              {c.name}
            </Link>
          ))}
        </div>

        {pros.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 sm:p-10">
            <div className="mx-auto max-w-[720px] text-center">
              <span className="mb-4 inline-flex rounded-full bg-[#FFF7EC] px-3 py-1 text-[12px] font-bold uppercase tracking-wide text-[#B26A00]">
                We are signing up pros here
              </span>
              <h2 className="mb-2 font-display text-2xl font-semibold">
                No {category.name.toLowerCase()} professional serves this area yet
              </h2>
              <p className="mx-auto mb-6 max-w-[560px] text-sm leading-relaxed text-muted-foreground">
                FixIt only lists a business after someone has checked the business details, so there is nobody to
                send this to today. Leave your email and we will tell you when there is. If you need it done now,
                post the job anyway: it stays open and reaches the first {category.name.toLowerCase()} professional who joins.
              </p>
            </div>
            <ServiceWaitlist slug={category.slug} name={category.name} />
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                href={`/request?service=${category.slug}`}
                className="rounded-md bg-accent px-6 py-3 text-sm font-bold text-accent-foreground hover:bg-accent/90"
              >
                Post the job now
              </Link>
              <Link
                href="/#services"
                className="rounded-md border border-border bg-card px-6 py-3 text-sm font-bold text-foreground/80 hover:border-primary"
              >
                Browse other services
              </Link>
            </div>
          </div>
        ) : (
          <ProResults pros={pros} />
        )}
      </section>
      <SiteFooter />
    </div>
  );
}
