import Link from "next/link";
import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/fixit/site-chrome";
import { SITE_EMAIL, SITE_PHONE } from "@/lib/site-contact";

export type PolicySection = {
  heading: string;
  paragraphs?: string[];
  items?: string[];
};

export type PolicyLink = { href: string; label: string };

/** The policy pages share one layout so the four read as one document. */
export function PolicyLayout({
  eyebrow,
  title,
  href,
  updated,
  intro,
  sections,
  related,
}: {
  eyebrow: string;
  title: string;
  /** The policy's own path, so the sidebar marks the page you are on. */
  href: string;
  updated: string;
  intro: string;
  sections: PolicySection[];
  related: PolicyLink[];
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1100px] flex-1 px-6 py-12 lg:grid lg:grid-cols-[220px_1fr] lg:gap-12">
        <aside className="mb-8 lg:mb-0">
          <nav aria-label="Policies" className="lg:sticky lg:top-24 grid gap-1">
            <span className="mb-2 text-[12.5px] font-bold uppercase tracking-wide text-muted-foreground">Policies</span>
            {related.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={
                  link.href === href
                    ? "rounded-md bg-primary/[0.08] px-3 py-2 text-[14px] font-semibold text-primary"
                    : "rounded-md px-3 py-2 text-[14px] text-foreground/75 hover:bg-muted"
                }
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </aside>
        <article className="min-w-0 max-w-[720px]">
          <p className="mb-2 text-[12.5px] font-bold uppercase tracking-wide text-primary">{eyebrow}</p>
          <h1 className="font-display text-3xl font-semibold sm:text-4xl">{title}</h1>
          <p className="mt-2 text-[13.5px] text-muted-foreground">Last updated {updated}</p>
          <p className="mt-6 text-[15.5px] leading-relaxed text-foreground/85">{intro}</p>
          <div className="mt-8 grid gap-8">
            {sections.map((section) => (
              <section key={section.heading}>
                <h2 className="mb-2 font-display text-xl font-semibold">{section.heading}</h2>
                {section.paragraphs?.map((text) => (
                  <p key={text.slice(0, 40)} className="mb-3 text-[15px] leading-relaxed text-foreground/80">
                    {text}
                  </p>
                ))}
                {section.items ? (
                  <ul className="grid gap-2">
                    {section.items.map((item) => (
                      <li key={item.slice(0, 40)} className="relative pl-5 text-[15px] leading-relaxed text-foreground/80">
                        <span className="absolute left-0 top-[10px] h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>
          <div className="mt-10 rounded-xl border border-border bg-muted/40 p-5 text-[14px] leading-relaxed text-foreground/80">
            Questions about this policy? Write to <a className="font-semibold text-primary underline" href={`mailto:${SITE_EMAIL}`}>{SITE_EMAIL}</a> or call {SITE_PHONE}.
          </div>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}

export const POLICY_UPDATED = "November 1, 2026";

export const POLICY_LINKS: PolicyLink[] = [
  { href: "/policies/privacy", label: "Privacy Policy" },
  { href: "/policies/terms", label: "Terms of Use" },
  { href: "/policies/pro-agreement", label: "Professional Agreement" },
  { href: "/policies/cookies", label: "Cookie Policy" },
];

export function policyMetadata(title: string, description: string): Metadata {
  return { title: `${title} — FixIt`, description };
}

export const RELATED = POLICY_LINKS;
