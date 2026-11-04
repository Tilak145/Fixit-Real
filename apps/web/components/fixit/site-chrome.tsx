"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { MapPin, ChevronDown, UserRound, Wrench, LogIn } from "lucide-react";
import { SITE_EMAIL, SITE_PHONE, SITE_PHONE_HREF } from "@/lib/site-contact";
import { ProWindow, type ProWindowMode } from "@/components/fixit/pro-window";
import { FixItLogo } from "./logo";
import { useAuth } from "@/lib/auth-context";
import { useCities } from "@/components/fixit/city-select";
import { rememberCity, readRememberedCity, resolveCity } from "@/lib/city-choice";

/**
 * The "where are you shopping?" control.
 *
 * Picking a city takes the visitor to the home page with that city applied, so
 * the top pros shown and the hero search both follow it, and remembers the
 * choice for next time. The label starts from whatever the page already knows
 * (the home page resolves a city from the URL) so the first paint matches the
 * server and does not flicker; only after mount does it fall back to the
 * remembered city when the page named none.
 */
function CityPicker({ city }: { city?: string | null }) {
  const router = useRouter();
  const { cities } = useCities();
  const active = cities.filter((entry) => entry.is_active).map((entry) => entry.label);
  const activeKey = active.join("|");
  const [selected, setSelected] = useState<string>(city ?? active[0] ?? "");

  useEffect(() => {
    // A city the page named (a shared link, say) always wins over memory.
    if (city) {
      setSelected(city);
      // Remember it too, so the next page in the visit agrees with this one
      // even when the link that carried it did not go through this control.
      rememberCity(city);
      return;
    }
    // Any page may arrive with ?city=Kent, OH. Reading it from the URL here
    // keeps every header consistent without every page having to pass it down.
    let fromUrl: string | null = null;
    try {
      fromUrl = new URLSearchParams(window.location.search).get("city");
    } catch {
      fromUrl = null;
    }
    const resolved = resolveCity(active, fromUrl, readRememberedCity());
    setSelected(resolved ?? "");
    if (fromUrl && resolved === fromUrl) rememberCity(fromUrl);
    // activeKey stands in for the list so the effect does not re-run on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, activeKey]);

  if (active.length === 0) return null;

  function choose(label: string) {
    setSelected(label);
    rememberCity(label);
    router.push("/?city=" + encodeURIComponent(label));
  }

  return (
    <span className="relative hidden items-center sm:flex">
      <MapPin className="pointer-events-none absolute left-3 h-4 w-4 text-accent" aria-hidden="true" />
      <ChevronDown className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
      <select
        aria-label="Choose your city"
        value={selected}
        onChange={(event) => {
          if (event.target.value) choose(event.target.value);
        }}
        className="h-9 appearance-none rounded-md border border-border bg-card pl-9 pr-8 text-sm font-semibold text-foreground/80 outline-none ring-ring hover:border-primary focus:ring-2"
      >
        {active.map((label) => (
          <option key={label} value={label}>
            {label}
          </option>
        ))}
      </select>
    </span>
  );
}

/**
 * The one door for professionals.
 *
 * There used to be two links side by side — "For Businesses" and "Pro
 * Dashboard" — that did nearly the same thing, and the second dropped a
 * newcomer on a sign-in form with no explanation. Now a single "For
 * businesses" menu says both things plainly: join, or sign in to the
 * dashboard you already have.
 */
function BusinessMenu({ onChoose }: { onChoose: (mode: Exclude<ProWindowMode, null>) => void }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocumentDown(event: MouseEvent) {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocumentDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocumentDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-primary px-3.5 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 sm:px-5"
      >
        <span className="sm:hidden">For Pros</span>
        <span className="hidden sm:inline">Join as a Pro</span>
        <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {open ? (
        <div className="absolute right-0 top-[calc(100%+10px)] z-50 w-[min(320px,calc(100vw-2rem))] rounded-xl border border-border bg-card p-2 shadow-xl">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onChoose("join");
            }}
            className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-muted"
          >
            <span className="mt-0.5 grid h-8 w-8 flex-none place-items-center rounded-lg bg-[#E9F1FB] text-primary">
              <Wrench className="h-4 w-4" aria-hidden="true" />
            </span>
            <span>
              <strong className="block text-[14px] text-secondary">Join as a pro</strong>
              <span className="block text-[12.5px] leading-snug text-muted-foreground">
                New to FixIt? Create a business account — first 100 pros get 3 months free.
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onChoose("signin");
            }}
            className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-muted"
          >
            <span className="mt-0.5 grid h-8 w-8 flex-none place-items-center rounded-lg bg-muted text-secondary">
              <LogIn className="h-4 w-4" aria-hidden="true" />
            </span>
            <span>
              <strong className="block text-[14px] text-secondary">Pro sign in</strong>
              <span className="block text-[12.5px] leading-snug text-muted-foreground">
                Already listed? Open your dashboard for leads, quotes and jobs.
              </span>
            </span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function SiteHeader({ city }: { city?: string | null } = {}) {
  // Signed-out visitors keep the plain Log in / Join as a Pro links, so the
  // page renders the same before the session is known.
  const { status, signOut } = useAuth();
  // Joining or signing in opens over the page instead of leaving it.
  const [proWindow, setProWindow] = useState<ProWindowMode>(null);
  const signedIn = status === "authenticated";
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card">
      <div className="mx-auto flex max-w-[1280px] items-center gap-3 px-4 py-4 sm:gap-8 sm:px-6">
        <FixItLogo />
        <nav className="hidden items-center gap-7 text-sm font-semibold text-foreground/80 md:flex">
          <Link href="/" className={pathname === "/" ? "text-primary" : "hover:text-primary"}>
            Home
          </Link>
          <Link href="/#how-it-works" className="hover:text-primary">
            How It Works
          </Link>
          <Link href="/#services" className="hover:text-primary">
            Services
          </Link>
        </nav>
        {/* Angi's arrangement: location, sign-in, join. */}
        <div className="ml-auto flex items-center gap-2.5 sm:gap-4">
          <CityPicker city={city} />
          {signedIn ? (
            <>
              <Link
                href="/account"
                className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-bold text-foreground/80 hover:text-primary"
              >
                <UserRound className="h-4 w-4" aria-hidden="true" />
                My account
              </Link>
              {/* Signed in, the primary button is the way out. Offering "Join"
                  to someone who already has an account reads as a bug. */}
              <button
                type="button"
                onClick={() => void signOut()}
                className="whitespace-nowrap rounded-full border border-border px-3 py-2.5 text-sm font-bold text-foreground/80 hover:border-primary hover:text-primary sm:px-5"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="whitespace-nowrap text-sm font-bold text-foreground/80 hover:text-primary">
                Log in
              </Link>
              {/* Phones have no room for both; the log-in page links to sign-up. */}
              <span aria-hidden="true" className="hidden text-border sm:inline">
                |
              </span>
              <Link
                href="/register"
                className="hidden whitespace-nowrap text-sm font-bold text-foreground/80 hover:text-primary sm:inline"
              >
                Sign up
              </Link>
              {/* The pro door sits in the header itself, as on Angi: join, or
                  the dashboard if the business already exists. */}
              <BusinessMenu onChoose={setProWindow} />
            </>
          )}
        </div>
      </div>
      <ProWindow mode={proWindow} onClose={() => setProWindow(null)} />
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="bg-foreground py-12 text-[#9FB0C4]">
      <div className="mx-auto flex max-w-[1280px] flex-wrap gap-12 px-6">
        <div className="min-w-[240px] flex-1">
          <FixItLogo dark />
          <p className="mt-3 max-w-[280px] text-sm leading-relaxed">
            The trusted marketplace for local home services. Real pros, real reviews, real results.
          </p>
        </div>
        <div className="w-40">
          <strong className="mb-3 block text-sm text-foreground">Services</strong>
          {["Plumbing", "Electrical", "HVAC", "Roofing", "Cleaning"].map((s) => (
            <Link
              key={s}
              href={`/services/${s.toLowerCase().replace(/\s+/g, "-")}`}
              className="mb-2 block text-sm hover:text-white"
            >
              {s}
            </Link>
          ))}
        </div>
        <div className="w-40">
          <strong className="mb-3 block text-sm text-foreground">Company</strong>
          <Link href="/#how-it-works" className="mb-2 block text-sm hover:text-white">
            How It Works
          </Link>
          <Link href="/for-businesses" className="mb-2 block text-sm hover:text-white">
            Join as a pro
          </Link>
          <Link href="/account" className="mb-2 block text-sm hover:text-white">
            My Account
          </Link>
          <Link href="/pro/dashboard" className="mb-2 block text-sm hover:text-white">
            Pro sign in
          </Link>
          {/* A separate door for the people who run FixIt; customer accounts use /login. */}
          <Link href="/admin" className="mb-2 block text-sm hover:text-white">
            Manager Sign-In
          </Link>
        </div>
        <div className="w-52">
          <strong className="mb-3 block text-sm text-foreground">Get in touch</strong>
          <a href={`mailto:${SITE_EMAIL}`} className="mb-2 block text-sm hover:text-white">
            {SITE_EMAIL}
          </a>
          <a href={SITE_PHONE_HREF} className="mb-2 block text-sm hover:text-white">
            {SITE_PHONE}
          </a>
          <span className="block text-sm">© 2026 FixIt Local Services</span>
        </div>
      </div>
      <div className="mx-auto mt-10 flex max-w-[1280px] flex-wrap items-center gap-x-6 gap-y-2 border-t border-white/10 px-6 pt-6 text-[13px]">
        {[
          ["/policies/privacy", "Privacy Policy"],
          ["/policies/terms", "Terms of Use"],
          ["/policies/pro-agreement", "Professional Agreement"],
          ["/policies/cookies", "Cookie Policy"],
        ].map(([href, label]) => (
          <Link key={href} href={href} className="hover:text-white">
            {label}
          </Link>
        ))}
      </div>
    </footer>
  );
}
